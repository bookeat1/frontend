import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as SecureStore from "expo-secure-store";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../auth";
import { getAccessToken } from "../token-store";

/**
 * REGRESSION GUARD — signing out must leave nothing of the previous person on
 * the phone.
 *
 * Two people share a phone; this is a real scenario for a booking app used in
 * a family or handed to a friend. If the query cache keeps `my-bookings`,
 * `favorites` or `me`, the next person sees the previous user's data — for a
 * frame, until the refetch replaces it, or forever on a screen that never
 * refetches. A frame is enough: it is somebody's name, phone number and where
 * they are having dinner tonight.
 *
 * The cache is asserted directly (`queryClient.getQueryData`) rather than
 * through a rendered screen: that is where the leak actually lives, and it
 * makes the test independent of which screen reads which key.
 */

const SESSION_KEY = "bookeat.session.v1";
const API_URL = "https://api.example.test/api/v1";

/** Private per-account keys, and the shape each one really holds. */
const PRIVATE_ENTRIES: Array<[readonly unknown[], unknown]> = [
  [["me"], { id: "u-1", name: "Дамир", phone: "+77010000000" }],
  [["my-bookings"], { items: [{ id: "b-1", name: "Дамир" }] }],
  [["favorites"], [{ id: "r-1" }]],
  // Prefixed keys must go too — removeQueries matches by prefix, and this is
  // the shape the detail screens really use.
  [["booking", "b-1"], { id: "b-1", phone: "+77010000000" }],
  [["preorder", "b-1"], { lines: [] }],
  [["booking-payment", "b-1"], { amountMinor: 500_000 }],
];

/** Public catalog data, which has no business being purged. */
const PUBLIC_ENTRIES: Array<[readonly unknown[], unknown]> = [
  [["restaurants"], [{ id: "r-1", name: "Chaihana Palau" }]],
  [["menu-sections", "r-1"], []],
];

function tokenPair(accessToken: string) {
  return {
    access_token: accessToken,
    refresh_token: `refresh-${accessToken}`,
    // Far enough out that nothing tries to refresh mid-test.
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify({ data: body }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function signedInSession() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const rendered = renderHook(() => useAuth(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
  });

  await waitFor(() => expect(rendered.result.current.status).toBe("signed-out"));
  await act(async () => {
    await rendered.result.current.signInWithCode({ phone: "+77010000000", code: "123456" });
  });
  await waitFor(() => expect(rendered.result.current.status).toBe("signed-in"));

  for (const [key, value] of [...PRIVATE_ENTRIES, ...PUBLIC_ENTRIES]) {
    queryClient.setQueryData(key, value);
  }
  return { queryClient, ...rendered };
}

beforeEach(() => {
  vi.stubEnv("EXPO_PUBLIC_API_URL", API_URL);
  // A tiny stand-in backend: verify the code, then answer /users/me.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.endsWith("/auth/otp/verify")) return jsonResponse(tokenPair("access-1"));
      if (url.endsWith("/users/me")) {
        return jsonResponse({ id: "u-1", name: "Дамир", phone: "+77010000000" });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    }),
  );
});

describe("signing out purges private cached data", () => {
  it("removes every per-account query, including prefixed ones", async () => {
    const { queryClient, result } = await signedInSession();
    for (const [key] of PRIVATE_ENTRIES) {
      expect(queryClient.getQueryData(key), `seeded ${JSON.stringify(key)}`).toBeDefined();
    }

    await act(async () => {
      await result.current.signOut();
    });

    for (const [key] of PRIVATE_ENTRIES) {
      expect(queryClient.getQueryData(key), `after sign-out ${JSON.stringify(key)}`).toBeUndefined();
    }
  });

  it("leaves the public catalog alone", async () => {
    const { queryClient, result } = await signedInSession();
    await act(async () => {
      await result.current.signOut();
    });
    for (const [key, value] of PUBLIC_ENTRIES) {
      expect(queryClient.getQueryData(key)).toEqual(value);
    }
  });

  it("the cache is already empty by the time the status says signed-out", async () => {
    // «Not even for one frame»: the purge and the status flip happen in the
    // same synchronous block, so no render can observe signed-out state next
    // to the previous person's bookings.
    const { queryClient, result } = await signedInSession();
    const observed: Array<{ status: string; leaked: boolean }> = [];
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      observed.push({
        status: result.current.status,
        leaked: queryClient.getQueryData(["my-bookings"]) !== undefined,
      });
    });

    await act(async () => {
      await result.current.signOut();
    });
    unsubscribe();

    expect(result.current.status).toBe("signed-out");
    expect(queryClient.getQueryData(["my-bookings"])).toBeUndefined();
    expect(observed.some((frame) => frame.status === "signed-out" && frame.leaked)).toBe(false);
  });

  it("forgets the user object and the bearer token", async () => {
    const { result } = await signedInSession();
    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(getAccessToken()).toBe("access-1");

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(getAccessToken()).toBeUndefined();
  });

  it("deletes the persisted session so a cold start does not restore it", async () => {
    const { result } = await signedInSession();
    expect(await SecureStore.getItemAsync(SESSION_KEY)).not.toBeNull();

    await act(async () => {
      await result.current.signOut();
    });

    expect(await SecureStore.getItemAsync(SESSION_KEY)).toBeNull();
  });

  it("the next person on the same phone sees nothing of the previous one", async () => {
    // Deliberately the SAME QueryClient: handing somebody a phone does not
    // restart the app, so the cache that mattered is the one still in memory.
    const { queryClient, result, unmount } = await signedInSession();
    await act(async () => {
      await result.current.signOut();
    });
    unmount();

    const next = renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      ),
    });
    await waitFor(() => expect(next.result.current.status).toBe("signed-out"));

    expect(next.result.current.user).toBeNull();
    for (const [key] of PRIVATE_ENTRIES) {
      expect(queryClient.getQueryData(key), `still cached: ${JSON.stringify(key)}`).toBeUndefined();
    }
  });
});
