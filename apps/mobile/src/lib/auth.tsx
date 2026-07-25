import {
  createAuthRepository,
  RepositoryError,
  type AuthRepository,
  type AuthSession,
  type AuthUser,
} from "@bookeat/api";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getAccessToken, setAccessToken } from "./token-store";

/**
 * Session state for the guest app.
 *
 * WHY email+password and not phone/OTP: `/api/v1/auth/otp/request` exists and
 * answers `{"sent": true}`, but the delivery adapter on this deployment is
 * `internal/infrastructure/otpsender.Stub` — it never sends anything, and the
 * code is withheld from the logs outside APP_ENV=development. A phone login
 * would be a screen nobody can get past. `/auth/signup` + `/auth/login`
 * (email + password) work end to end, verified against the test backend on
 * 2026-07-25 including creating a real booking with the resulting token.
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
  signIn(input: { email: string; password: string }): Promise<void>;
  signUp(input: { email: string; password: string; fullName: string }): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Returns a token that is valid for at least the next minute, refreshing if
   * needed, or null when there is no usable session. Call this immediately
   * before an authenticated write — access tokens live ~15 minutes and this
   * flow can sit on the confirmation step for longer than that.
   */
  ensureFreshToken(): Promise<string | null>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(
    () => createAuthRepository(process.env.EXPO_PUBLIC_API_URL, { getToken: getAccessToken }),
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

  const applySession = useCallback(async (session: AuthSession | null) => {
    sessionRef.current = session;
    setAccessToken(session?.accessToken);
    setStatus(session ? "signed-in" : "signed-out");
    if (!session) setUser(null);
    await persist(session);
  }, []);

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

  const ensureFreshToken = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    if (!isExpiring(current)) return current.accessToken;
    // Single-flight: the refresh token is single-use, so two concurrent
    // refreshes would have one of them invalidate the other's session.
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        try {
          const refreshed = await repository.refresh(current.refreshToken);
          await applySession(refreshed);
          return refreshed.accessToken;
        } catch (error) {
          if (error instanceof RepositoryError && error.isUnauthorized) {
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

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      await applySession(await repository.signIn(input));
      void loadUser();
    },
    [applySession, loadUser, repository],
  );

  const signUp = useCallback(
    async (input: { email: string; password: string; fullName: string }) => {
      await applySession(await repository.signUp(input));
      void loadUser();
    },
    [applySession, loadUser, repository],
  );

  const signOut = useCallback(async () => {
    await applySession(null);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, repository, signIn, signUp, signOut, ensureFreshToken }),
    [status, user, repository, signIn, signUp, signOut, ensureFreshToken],
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
