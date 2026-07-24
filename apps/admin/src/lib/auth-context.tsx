"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, RestaurantProfile } from "@bookeat/api/admin";

import { apiClient, clearSession, STORAGE_KEYS } from "./api";

/** The restaurant the panel is currently operating on. Derived from a profile
 * the staff member proved access to (see RestaurantGate). */
export interface RestaurantContext {
  id: string;
  name: string;
}

interface AuthState {
  /** false until localStorage has been read on the client (avoids an
   * SSR/hydration flash and a premature redirect to /login). */
  hydrated: boolean;
  token: string | null;
  user: AuthUser | null;
  restaurant: RestaurantContext | null;
}

interface AuthContextValue extends AuthState {
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  selectRestaurant(profile: RestaurantProfile): void;
  clearRestaurant(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    hydrated: false,
    token: null,
    user: null,
    restaurant: null,
  });

  useEffect(() => {
    setState({
      hydrated: true,
      token: window.localStorage.getItem(STORAGE_KEYS.accessToken),
      user: readJson<AuthUser>(STORAGE_KEYS.user),
      restaurant: readJson<RestaurantContext>(STORAGE_KEYS.restaurant),
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const pair = await apiClient.login(email.trim(), password);
    window.localStorage.setItem(STORAGE_KEYS.accessToken, pair.access_token);
    window.localStorage.setItem(STORAGE_KEYS.refreshToken, pair.refresh_token);
    // getToken now returns the fresh token, so getMe is authorized.
    const user = await apiClient.getMe();
    window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    setState((prev) => ({ ...prev, hydrated: true, token: pair.access_token, user }));
  }, []);

  const logout = useCallback(async () => {
    const refresh = window.localStorage.getItem(STORAGE_KEYS.refreshToken);
    if (refresh) {
      // Best-effort server-side revocation; never block logout on it.
      try {
        await apiClient.logout(refresh);
      } catch {
        /* ignore — local session is cleared regardless */
      }
    }
    clearSession();
    setState({ hydrated: true, token: null, user: null, restaurant: null });
  }, []);

  const selectRestaurant = useCallback((profile: RestaurantProfile) => {
    const ctx: RestaurantContext = { id: profile.id, name: profile.name };
    window.localStorage.setItem(STORAGE_KEYS.restaurant, JSON.stringify(ctx));
    setState((prev) => ({ ...prev, restaurant: ctx }));
  }, []);

  const clearRestaurant = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEYS.restaurant);
    setState((prev) => ({ ...prev, restaurant: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, selectRestaurant, clearRestaurant }),
    [state, login, logout, selectRestaurant, clearRestaurant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
