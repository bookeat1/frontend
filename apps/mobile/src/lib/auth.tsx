import {
  createAuthRepository,
  RepositoryError,
  type AuthRepository,
  type AuthSession,
  type AuthUser,
  type OtpRequest,
} from "@bookeat/api";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "./analytics";
import { runPushSignOutHook } from "./push-signout";
import {
  getFreshAccessToken,
  refreshAfterUnauthorized as gatewayRefreshAfterUnauthorized,
  setAccessToken,
  setSessionTokenGateway,
} from "./token-store";

/**
 * Session state for the guest app.
 *
 * WHY phone + one-time code and nothing else (2026-07-26): the guest signs in
 * with a number they already own, and there is no separate registration step —
 * `POST /auth/otp/verify` finds OR CREATES the user itself
 * (internal/usecase/auth/otp.go: users.GetByPhone → users.Create). Email +
 * password still exists on the backend and is still reachable through
 * `AuthRepository`, but no screen offers it: two ways in is two ways to end up
 * with two accounts for one person.
 *
 * DELIVERY IS A SEPARATE PROBLEM from this module: the server answers
 * `{"sent": true}` as soon as it hands the code to its waterfall, and on a
 * deployment with no channel credentials that waterfall degrades to
 * `otpsender.Stub`, which delivers nothing. The screen says so; this file just
 * reports what the API returned.
 *
 * WHY SecureStore: the access token is a bearer credential. Keychain /
 * Android Keystore is the only storage in this app that isn't plain
 * JS-readable text. On web SecureStore is unavailable, so the session simply
 * does not persist there (the app still works, sign-in just doesn't survive
 * a reload) — no silent downgrade to localStorage.
 */
const SESSION_KEY = "bookeat.session.v1";
/** Refresh this long before the access token actually expires, so a request
 * started right at the boundary doesn't race the clock. */
const REFRESH_SKEW_MS = 60_000;

export type AuthStatus = "loading" | "signed-out" | "signed-in";

interface AuthContextValue {
  status: AuthStatus;
  /** The signed-in user, once /users/me has answered. Null while it hasn't —
   * prefill is a nicety, never a gate. */
  user: AuthUser | null;
  repository: AuthRepository;
  /**
   * Asks the backend to send a one-time code to an E.164 phone. Returns what
   * the server said — `sent` is "accepted for delivery", never "delivered".
   */
  requestCode(phone: string): Promise<OtpRequest>;
  /** Exchanges phone + code for a session. Creates the account server-side on
   * the first successful code for a new number. */
  signInWithCode(input: { phone: string; code: string }): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Returns a token that is valid for at least the next minute, refreshing if
   * needed, or null when there is no usable session. Every authenticated
   * request goes through this (see token-store's gateway); call it directly
   * before a write that wants to fail fast on a dead session.
   */
  ensureFreshToken(): Promise<string | null>;
  /**
   * Recovery path for a 401 the pre-flight refresh did not prevent (skewed
   * device clock, token revoked server-side). Returns the token to retry with,
   * or null when the session is gone — in which case the guest has already
   * been signed out and the screens show their signed-out state.
   */
  refreshAfterUnauthorized(staleToken: string): Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isExpiring(session: AuthSession): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  // An unparseable expiry is treated as "expiring": refreshing needlessly is
  // cheap, serving a dead token is a failed booking.
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt - Date.now() <= REFRESH_SKEW_MS;
}

async function persist(session: AuthSession | null): Promise<void> {
  try {
    if (session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch {
    // SecureStore is unavailable on web and can fail on a device with no
    // screen lock. The session stays in memory for this run rather than the
    // app refusing to sign anyone in.
  }
}

async function readPersisted(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as AuthSession).accessToken === "string" &&
      typeof (parsed as AuthSession).refreshToken === "string"
    ) {
      return parsed as AuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cached data that belongs to ONE account and must not survive a sign-out —
 * the next person to use the phone would otherwise see a flash of somebody
 * else's bookings before the refetch replaced them. Written as literals rather
 * than imported from the hooks, which already import this module.
 */
const PRIVATE_QUERY_KEYS = [
  ["me"],
  ["my-bookings"],
  ["favorites"],
  ["booking"],
  ["preorder"],
  ["booking-payment"],
] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const repository = useMemo(
    () =>
      createAuthRepository(process.env.EXPO_PUBLIC_API_URL, {
        // Same fresh-token path as the catalog repository: /users/me is an
        // authenticated READ and used to die silently after 15 minutes.
        // No recursion — POST /auth/refresh is not an authenticated call.
        getToken: getFreshAccessToken,
        onUnauthorized: gatewayRefreshAfterUnauthorized,
      }),
    [],
  );

  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  // The session is mirrored into a ref because ensureFreshToken must read the
  // current value from inside an async callback that closed over an older
  // render, and because the refresh token rotates — reading a stale one would
  // burn the session.
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const applySession = useCallback(
    async (session: AuthSession | null) => {
      sessionRef.current = session;
      setAccessToken(session?.accessToken);
      setStatus(session ? "signed-in" : "signed-out");
      if (!session) {
        setUser(null);
        for (const key of PRIVATE_QUERY_KEYS) {
          queryClient.removeQueries({ queryKey: key });
        }
      }
      await persist(session);
    },
    [queryClient],
  );

  const loadUser = useCallback(async () => {
    try {
      setUser(await repository.getMe());
    } catch {
      // Prefill only. A failed /users/me must not knock the guest out of a
      // session that is otherwise fine.
    }
  }, [repository]);

  // Hydrate once. A stored session whose access token has already expired is
  // refreshed here rather than shown as signed-out — otherwise every cold
  // start after 15 minutes would look like a logout.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readPersisted();
      if (cancelled) return;
      if (!stored) {
        await applySession(null);
        return;
      }
      if (!isExpiring(stored)) {
        await applySession(stored);
        void loadUser();
        return;
      }
      try {
        const refreshed = await repository.refresh(stored.refreshToken);
        if (cancelled) return;
        await applySession(refreshed);
        void loadUser();
      } catch {
        if (cancelled) return;
        await applySession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession, loadUser, repository]);

  /**
   * Spends the refresh token, once.
   *
   * Single-flight: the refresh token is single-use (verified on the test
   * backend — a replay answers 401), so two concurrent refreshes would have
   * the second one burn the session the first just created. Everyone who asks
   * while a refresh is in flight waits on the SAME promise.
   */
  const refreshNow = useCallback((): Promise<string | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        const current = sessionRef.current;
        if (!current) return null;
        try {
          const refreshed = await repository.refresh(current.refreshToken);
          await applySession(refreshed);
          return refreshed.accessToken;
        } catch (error) {
          if (error instanceof RepositoryError && error.isUnauthorized) {
            // The refresh token itself is dead: this is a logout, not a
            // failure. Signing out cleanly is what makes the screens show
            // «Вы не вошли» with a way back in instead of a network error.
            await applySession(null);
            return null;
          }
          // A network blip is not a logout — keep the session and let the
          // caller's own error handling surface "try again".
          throw error;
        } finally {
          refreshInFlight.current = null;
        }
      })();
    }
    return refreshInFlight.current;
  }, [applySession, repository]);

  const ensureFreshToken = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    if (!isExpiring(current)) return current.accessToken;
    return refreshNow();
  }, [refreshNow]);

  const refreshAfterUnauthorized = useCallback(
    async (staleToken: string): Promise<string | null> => {
      const current = sessionRef.current;
      // Already signed out (a concurrent refresh found the session dead).
      if (!current) return null;
      // Somebody else already refreshed while this request was in flight —
      // hand out the fresh token instead of burning another refresh token on
      // a race that is already won.
      if (current.accessToken !== staleToken) return current.accessToken;
      return refreshNow();
    },
    [refreshNow],
  );

  // The repositories are built once at app start and cannot read React
  // context, so the session operations are published into the token cell they
  // do read. Registered in an effect (never during render) and cleared on
  // unmount so a torn-down provider can't be called into.
  useEffect(() => {
    setSessionTokenGateway({ ensureFreshToken, refreshAfterUnauthorized });
    return () => setSessionTokenGateway(null);
  }, [ensureFreshToken, refreshAfterUnauthorized]);

  const requestCode = useCallback(
    (phone: string) => repository.requestOtp(phone),
    [repository],
  );

  const signInWithCode = useCallback(
    async (input: { phone: string; code: string }) => {
      await applySession(await repository.verifyOtp(input));
      // Explicit `login` event on a real OTP verify only. Fired here rather than
      // from the AnalyticsProvider so a cold-start rehydrate (which also reaches
      // "signed-in") is never counted as a login. Best-effort and non-throwing.
      trackEvent("login");
      void loadUser();
    },
    [applySession, loadUser, repository],
  );

  const signOut = useCallback(async () => {
    // Silence this phone BEFORE the token is thrown away: the deregister call
    // is authenticated, and after `applySession(null)` it would be a
    // guaranteed 401 — which would leave the device receiving the NEXT
    // person's booking notifications. Bounded and non-throwing by contract,
    // so a dead connection cannot block a sign-out.
    await runPushSignOutHook();
    await applySession(null);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      repository,
      requestCode,
      signInWithCode,
      signOut,
      ensureFreshToken,
      refreshAfterUnauthorized,
    }),
    [
      status,
      user,
      repository,
      requestCode,
      signInWithCode,
      signOut,
      ensureFreshToken,
      refreshAfterUnauthorized,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}
