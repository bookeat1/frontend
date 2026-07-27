import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../auth";
import { runPushSignOutHook, setPushSignOutHook } from "../push-signout";
import { getAccessToken } from "../token-store";

/**
 * WHAT BREAKS FOR THE GUEST IF THIS FILE GOES RED.
 *
 * `DELETE /devices/push-tokens` is an authenticated call. Run it a moment too
 * late — after the session has been thrown away — and it is a guaranteed 401,
 * which means the phone stays registered to the person who just signed out.
 * On a shared phone the next guest's «Бронь подтверждена» then lands on the
 * previous guest's screen. So the ordering is the feature, and it is asserted
 * here directly: the hook must see a live token.
 *
 * The mirror-image failure is just as real: a guest on a dead connection taps
 * «Выйти» and waits for an HTTP timeout that will never help them. Sign-out is
 * not allowed to depend on the network.
 */

const API_URL = "https://api.example.test/api/v1";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify({ data: body }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function signedIn() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  return rendered;
}

beforeEach(() => {
  vi.stubEnv("EXPO_PUBLIC_API_URL", API_URL);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.endsWith("/auth/otp/verify")) {
        return jsonResponse({
          access_token: "access-1",
          refresh_token: "refresh-1",
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        });
      }
      if (url.endsWith("/users/me")) return jsonResponse({ id: "u-1", phone: "+77010000000" });
      throw new Error(`Unexpected request in test: ${url}`);
    }),
  );
});

afterEach(() => {
  setPushSignOutHook(null);
});

describe("deregistering the device on sign-out", () => {
  it("runs while the session is still alive, not after it is gone", async () => {
    const tokenSeenByHook: Array<string | undefined> = [];
    setPushSignOutHook(async () => {
      tokenSeenByHook.push(getAccessToken());
    });

    const { result } = await signedIn();
    expect(getAccessToken()).toBe("access-1");

    await act(async () => {
      await result.current.signOut();
    });

    // The single most important assertion in this file: a live bearer token
    // was available when the deregister call was made.
    expect(tokenSeenByHook).toEqual(["access-1"]);
    expect(getAccessToken()).toBeUndefined();
    expect(result.current.status).toBe("signed-out");
  });

  it("a hook that throws does not keep the guest signed in", async () => {
    setPushSignOutHook(async () => {
      throw new Error("no network");
    });

    const { result } = await signedIn();
    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe("signed-out");
    expect(getAccessToken()).toBeUndefined();
  });

  it("a hook that never settles does not hold sign-out hostage", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setPushSignOutHook(() => new Promise<void>(() => {}));

    const done = vi.fn();
    const promise = runPushSignOutHook().then(done);
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("no hook registered is not an error", async () => {
    await expect(runPushSignOutHook()).resolves.toBeUndefined();

    const { result } = await signedIn();
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.status).toBe("signed-out");
  });
});
