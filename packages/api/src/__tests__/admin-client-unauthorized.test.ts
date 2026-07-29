import { describe, expect, it, vi } from "vitest";

import { AdminApiClient, AdminApiError } from "../admin/client";

/**
 * REGRESSION GUARD — the panel's HTTP client had no way to survive an expired
 * access token, so every 401 became a full sign-out for the person using it.
 *
 * The backend's access tokens live 15 minutes. What a venue employee saw was
 * the panel throwing them out mid-service; what the client was missing was the
 * two hooks below — a token fetched fresh (possibly renewed) before the request
 * goes out, and one replay of a request whose token died anyway.
 *
 * The dangerous shape of this fix is a loop: 401 -> renew -> 401 -> renew, which
 * would hammer the API and never show anything. Hence "exactly once", asserted.
 */

const BASE = "https://api.example.test/api/v1";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authHeaderOf(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit;
  return (init.headers as Record<string, string>).Authorization;
}

describe("an access token that dies mid-shift", () => {
  it("sends the token the session hands over, even when fetching it is async", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: { restaurants: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AdminApiClient({
      baseUrl: BASE,
      getToken: async () => "renewed-token",
    });
    await client.listMyRestaurants();

    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe("Bearer renewed-token");
  });

  it("renews and replays the request once, so the employee never notices", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { restaurants: [{ id: "r-1" }] } }));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn(async () => "access-new");
    const client = new AdminApiClient({
      baseUrl: BASE,
      getToken: () => "access-old",
      onUnauthorized,
    });

    await expect(client.listMyRestaurants()).resolves.toEqual([{ id: "r-1" }]);
    expect(onUnauthorized).toHaveBeenCalledWith("access-old");
    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe("Bearer access-old");
    expect(authHeaderOf(fetchMock.mock.calls[1])).toBe("Bearer access-new");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after ONE replay instead of looping on a token that keeps failing", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn(async () => "access-new");
    const client = new AdminApiClient({ baseUrl: BASE, getToken: () => "old", onUnauthorized });

    await expect(client.listMyRestaurants()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("lets the 401 through when the session says it cannot be recovered", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AdminApiClient({
      baseUrl: BASE,
      getToken: () => "old",
      onUnauthorized: async () => null,
    });

    await expect(client.listMyRestaurants()).rejects.toBeInstanceOf(AdminApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never asks the session to recover an unauthenticated call, so refresh cannot recurse", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "invalid refresh token" }));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn(async () => "access-new");
    const client = new AdminApiClient({ baseUrl: BASE, getToken: () => "old", onUnauthorized });

    // POST /auth/refresh is sent with auth: false.
    await expect(client.refresh("refresh-old")).rejects.toBeInstanceOf(AdminApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
