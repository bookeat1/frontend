"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@bookeat/api/admin";

import { apiClient, clearSession, session, STORAGE_KEYS } from "./api";
import { browserStorage } from "./token-store";
import { clearRecentVenues, rememberVenue } from "./venue-picking";

/** The restaurant the panel is currently operating on. Picked from
 * GET /admin/my-restaurants (see RestaurantPicker) and kept in localStorage so
 * it survives a reload. */
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
  /** Resolves with the freshly-authenticated user so callers can act on the
   * identity immediately (e.g. attach it to analytics before the provider's
   * effect runs on the next render). */
  login(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  selectRestaurant(restaurant: RestaurantContext): void;
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
  // AuthProvider is mounted inside QueryClientProvider (see app/providers.tsx),
  // so the cache can be dropped whenever the data scope changes.
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    hydrated: false,
    token: null,
    user: null,
    restaurant: null,
  });
  /** Mirrors state.restaurant.id so selectRestaurant can tell a real switch
   * from a re-select without depending on (and re-creating itself on) state. */
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const restaurant = readJson<RestaurantContext>(STORAGE_KEYS.restaurant);
    selectedIdRef.current = restaurant?.id ?? null;
    setState({
      hydrated: true,
      token: window.localStorage.getItem(STORAGE_KEYS.accessToken),
      user: readJson<AuthUser>(STORAGE_KEYS.user),
      restaurant,
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Whoever was signed in before must leave nothing behind: a stale
    // my-restaurants list would otherwise flash (or auto-select) another
    // person's venue for the new session.
    selectedIdRef.current = null;
    queryClient.clear();
    const pair = await apiClient.login(email.trim(), password);
    // The session owns token storage — it also records `expires_at`, which is
    // what lets it renew the token before the shift is interrupted.
    session.store(pair);
    // getToken now returns the fresh token, so getMe is authorized.
    const user = await apiClient.getMe();
    window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    setState((prev) => ({ ...prev, hydrated: true, token: pair.access_token, user }));
    return user;
  }, [queryClient]);

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
    // The venue history is part of the session: the next person on a shared
    // machine must not inherit someone else's shortcuts.
    clearRecentVenues(browserStorage());
    selectedIdRef.current = null;
    queryClient.clear();
    setState({ hydrated: true, token: null, user: null, restaurant: null });
  }, [queryClient]);

  const selectRestaurant = useCallback(
    (restaurant: RestaurantContext) => {
      const ctx: RestaurantContext = { id: restaurant.id, name: restaurant.name };
      const previousId = selectedIdRef.current;
      // Every screen's query key is scoped by restaurant id, so venue B can
      // never read venue A's entry — but B's screens would still mount while
      // A's rows sit in the cache. Dropping everything except the venue list on
      // a real switch makes it show a loading state, never a frame of venue A.
      // A same-id call (a rename picked up from my-restaurants) keeps the cache.
      if (previousId && previousId !== ctx.id) {
        queryClient.removeQueries({
          predicate: (q) => q.queryKey[0] !== "my-restaurants",
        });
      }
      selectedIdRef.current = ctx.id;
      window.localStorage.setItem(STORAGE_KEYS.restaurant, JSON.stringify(ctx));
      // Feeds the switcher's «Недавние» block: what a person came back to is a
      // better shortcut than alphabetical order over a hundred venues.
      rememberVenue(browserStorage(), ctx.id);
      setState((prev) =>
        prev.restaurant?.id === ctx.id && prev.restaurant.name === ctx.name
          ? prev // no-op: don't re-render (and don't re-trigger the reconcile effect)
          : { ...prev, restaurant: ctx },
      );
    },
    [queryClient],
  );

  const clearRestaurant = useCallback(() => {
    selectedIdRef.current = null;
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

/**
 * The same context, but tolerant of not being inside the provider. Used by
 * shared cards that are also rendered standalone in tests (and by the venue
 * catalog, where "switch the panel's venue" is not the right offer) — they need
 * to know whether they can offer a venue switch at all, not to crash.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
