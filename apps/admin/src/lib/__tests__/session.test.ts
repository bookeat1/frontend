import { AdminApiError } from "@bookeat/api/admin";
import type { TokenPair } from "@bookeat/api/admin";
import { RepositoryError } from "@bookeat/api";
import { describe, expect, it, vi } from "vitest";

import { AdminSession } from "../session";
import { STORAGE_KEYS, type TokenStorage } from "../token-store";

/**
 * REGRESSION GUARD — a venue employee was signed out of the panel every fifteen
 * minutes, mid-service.
 *
 * The backend issues access tokens with AUTH_ACCESS_TOKEN_TTL=15m and refresh
 * tokens with AUTH_REFRESH_TOKEN_TTL=720h, and exposes POST /auth/refresh — but
 * nothing in the panel ever called it. A hostess taking bookings during a full
 * house lost the screen four times an hour: her token simply died, the panel
 * bounced her out, and she had to sign in again with a queue at the door.
 *
 * What must never regress: a session that CAN be renewed is renewed silently,
 * and only a session the backend actually refuses ends the shift. Two details
 * of the backend make this sharper than it looks (usecase/auth.facade.Refresh):
 *
 * - refresh tokens rotate and the old one is revoked with no grace period, so
 *   two tabs (or two parallel requests) refreshing at once would revoke each
 *   other and sign the whole venue out;
 * - a refused refresh (401) and an unreachable server look nothing alike to a
 *   person: the first means "sign in again", the second means "the Wi-Fi
 *   blinked" and must not touch the session at all.
 */

const NOW = Date.parse("2026-07-27T12:00:00Z");

function fakeStorage(initial: Record<string, string> = {}): TokenStorage & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

/** A signed-in employee whose access token dies `msLeft` from now. */
function signedIn(msLeft: number, access = "access-old") {
  return fakeStorage({
    [STORAGE_KEYS.accessToken]: access,
    [STORAGE_KEYS.refreshToken]: "refresh-old",
    [STORAGE_KEYS.expiresAt]: new Date(NOW + msLeft).toISOString(),
    [STORAGE_KEYS.user]: '{"id":"u-1"}',
  });
}

function pair(access: string, refresh: string, msLeft = 15 * 60_000): TokenPair {
  return {
    access_token: access,
    refresh_token: refresh,
    expires_at: new Date(NOW + msLeft).toISOString(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A lock that really serialises, the way the Web Locks API does across tabs. */
function serialLock() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(run: () => Promise<T>): Promise<T> => {
    const next = tail.then(run, run);
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}

interface Harness {
  storage: TokenStorage;
  refresh: ReturnType<typeof vi.fn>;
  onSessionLost: ReturnType<typeof vi.fn>;
}

function makeSession(
  storage: TokenStorage,
  refresh: (token: string) => Promise<TokenPair>,
  withLock?: <T>(run: () => Promise<T>) => Promise<T>,
): { session: AdminSession } & Harness {
  const refreshSpy = vi.fn(refresh);
  const onSessionLost = vi.fn();
  const session = new AdminSession({
    refresh: refreshSpy,
    onSessionLost,
    storage: () => storage,
    now: () => NOW,
    withLock,
  });
  return { session, storage, refresh: refreshSpy, onSessionLost };
}

describe("a shift that keeps going", () => {
  it("renews a token that is about to expire instead of letting the request die", async () => {
    const { session, refresh, onSessionLost, storage } = makeSession(
      signedIn(30_000), // 30s left — less than the renewal lead
      async () => pair("access-new", "refresh-new"),
    );

    await expect(session.accessToken()).resolves.toBe("access-new");
    expect(refresh).toHaveBeenCalledWith("refresh-old");
    expect(onSessionLost).not.toHaveBeenCalled();
    // The rotated refresh token is stored too: presenting the old one again
    // would be a 401, because the backend revokes it on rotation.
    expect(storage.getItem(STORAGE_KEYS.refreshToken)).toBe("refresh-new");
  });

  it("renews after the laptop slept through the expiry, rather than bouncing", async () => {
    const { session, refresh, onSessionLost } = makeSession(
      signedIn(-42 * 60_000), // woke up 42 minutes past expiry
      async () => pair("access-new", "refresh-new"),
    );

    await expect(session.accessToken()).resolves.toBe("access-new");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it("leaves a healthy token alone", async () => {
    const { session, refresh } = makeSession(signedIn(10 * 60_000), async () =>
      pair("access-new", "refresh-new"),
    );

    await expect(session.accessToken()).resolves.toBe("access-old");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("retries a request that was already in flight when the token expired", async () => {
    const { session, refresh, onSessionLost } = makeSession(
      signedIn(10 * 60_000), // looks healthy locally; the server said 401 anyway
      async () => pair("access-new", "refresh-new"),
    );

    await expect(session.recoverAfterUnauthorized("access-old")).resolves.toBe("access-new");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onSessionLost).not.toHaveBeenCalled();
  });
});

describe("nobody revokes anybody else's token", () => {
  it("refreshes once for several requests that hit the expiring token together", async () => {
    const gate = deferred<TokenPair>();
    const { session, refresh } = makeSession(signedIn(5_000), () => gate.promise);

    const all = Promise.all([session.accessToken(), session.accessToken(), session.accessToken()]);
    gate.resolve(pair("access-new", "refresh-new"));

    await expect(all).resolves.toEqual(["access-new", "access-new", "access-new"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("a second tab waits for the first and reuses its token, never rotating twice", async () => {
    // Two tabs, one storage, one lock — exactly what two open panels are.
    const storage = signedIn(5_000);
    const lock = serialLock();
    const gate = deferred<TokenPair>();
    const tabA = makeSession(storage, () => gate.promise, lock);
    const tabB = makeSession(storage, async () => pair("access-B", "refresh-B"), lock);

    const a = tabA.session.accessToken();
    const b = tabB.session.accessToken();
    gate.resolve(pair("access-new", "refresh-new"));

    await expect(a).resolves.toBe("access-new");
    await expect(b).resolves.toBe("access-new");
    expect(tabA.refresh).toHaveBeenCalledTimes(1);
    expect(tabB.refresh).not.toHaveBeenCalled();
    expect(tabB.onSessionLost).not.toHaveBeenCalled();
  });

  it("retries with the token another tab has already stored, without refreshing", async () => {
    const storage = signedIn(10 * 60_000, "access-fresh-from-other-tab");
    const { session, refresh } = makeSession(storage, async () => pair("access-new", "refresh-new"));

    // Our request went out carrying the pre-rotation token and got a 401.
    await expect(session.recoverAfterUnauthorized("access-old")).resolves.toBe(
      "access-fresh-from-other-tab",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("when the session really is over", () => {
  it("ends the session only when the backend refuses the refresh token", async () => {
    const { session, storage, onSessionLost } = makeSession(signedIn(5_000), async () => {
      throw new AdminApiError("unauthorized", 401);
    });

    await expect(session.accessToken()).resolves.toBeNull();
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(storage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.user)).toBeNull();
  });

  it("ends the session when there is no refresh token to present", async () => {
    const storage = signedIn(5_000);
    storage.removeItem(STORAGE_KEYS.refreshToken);
    const { session, refresh, onSessionLost } = makeSession(storage, async () =>
      pair("access-new", "refresh-new"),
    );

    await expect(session.accessToken()).resolves.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });

  it("does NOT sign anyone out because the network dropped", async () => {
    const { session, storage, onSessionLost } = makeSession(signedIn(5_000), async () => {
      throw new RepositoryError("Network error requesting /auth/refresh");
    });

    await expect(session.accessToken()).rejects.toBeInstanceOf(RepositoryError);
    expect(onSessionLost).not.toHaveBeenCalled();
    // Still signed in: the next attempt can succeed once the connection is back.
    expect(storage.getItem(STORAGE_KEYS.accessToken)).toBe("access-old");
    expect(storage.getItem(STORAGE_KEYS.refreshToken)).toBe("refresh-old");
  });

  it("recovers on the next attempt after a network failure", async () => {
    const storage = signedIn(5_000);
    let attempt = 0;
    const { session, onSessionLost } = makeSession(storage, async () => {
      attempt += 1;
      if (attempt === 1) throw new RepositoryError("Network error requesting /auth/refresh");
      return pair("access-new", "refresh-new");
    });

    await expect(session.accessToken()).rejects.toBeInstanceOf(RepositoryError);
    await expect(session.accessToken()).resolves.toBe("access-new");
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it("ends the session when another tab has already signed out", async () => {
    const storage = fakeStorage();
    const { session, refresh, onSessionLost } = makeSession(storage, async () =>
      pair("access-new", "refresh-new"),
    );

    // No token at all: `accessToken` is simply "not signed in" (the layout
    // routes to login), while a 401 answer means the session died under us.
    await expect(session.accessToken()).resolves.toBeNull();
    expect(onSessionLost).not.toHaveBeenCalled();

    await expect(session.recoverAfterUnauthorized("access-old")).resolves.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });
});

describe("a session created before expiry was stored", () => {
  it("reads the expiry out of the JWT so it is still renewed ahead of time", async () => {
    // A real access token is a JWT; older sessions have no stored expires_at.
    const exp = Math.floor((NOW + 20_000) / 1000);
    const jwt = `header.${btoa(JSON.stringify({ exp })).replace(/=+$/, "")}.signature`;
    const storage = fakeStorage({
      [STORAGE_KEYS.accessToken]: jwt,
      [STORAGE_KEYS.refreshToken]: "refresh-old",
    });
    const { session, refresh } = makeSession(storage, async () => pair("access-new", "refresh-new"));

    await expect(session.accessToken()).resolves.toBe("access-new");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps working when the expiry cannot be read at all", async () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.accessToken]: "not-a-jwt",
      [STORAGE_KEYS.refreshToken]: "refresh-old",
    });
    const { session, refresh } = makeSession(storage, async () => pair("access-new", "refresh-new"));

    // Unknown expiry means no head start, not a refresh on every request.
    await expect(session.accessToken()).resolves.toBe("not-a-jwt");
    expect(refresh).not.toHaveBeenCalled();
    // The 401 path still recovers it.
    await expect(session.recoverAfterUnauthorized("not-a-jwt")).resolves.toBe("access-new");
  });
});
