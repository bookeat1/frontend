import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback } from "react";

/**
 * The city chosen ON THIS DEVICE.
 *
 * WHY IT EXISTS: the city picker used to persist the choice to the account
 * ONLY (`PATCH /users/me`). A signed-out guest has no account, so the request
 * failed, a `catch` swallowed it, and the header kept showing the fallback
 * city — tapping a city did literally nothing. Since the Home feed, «Афиша»
 * and «Акции» are all city-scoped, that pinned every guest without a session
 * to Almaty's content with no way out.
 *
 * STORAGE: expo-secure-store, the only key-value storage this app carries
 * (same module as the session, the locale and the notifications preference —
 * see locale.tsx for why AsyncStorage is not worth a second native dependency).
 * The city is not a secret; it lives here because this is where this app keeps
 * small durable values. On web SecureStore no-ops, so the choice lasts the
 * session there, exactly like the language.
 *
 * SHAPE: the hydrated value lives in the react-query cache under
 * `["preferred-city"]` rather than in a React context. That is deliberate —
 * every consumer (the Home header, `useGuestCity`, the profile screens) then
 * shares one cache entry with no new provider to mount, and a write is visible
 * to all of them on the next render, the same way the `["me"]` cache already
 * works in this app.
 *
 * NOT a private key: it is deliberately absent from `PRIVATE_QUERY_KEYS` in
 * auth.tsx, i.e. it survives sign-out. A device preference is not account
 * data, and dropping it on sign-out would flip the content under the guest at
 * the exact moment he signed out.
 */
const PREFERRED_CITY_KEY = "bookeat.city.v1";

/** Cache key of the hydrated device city. Exported for the sign-out/reset paths
 * and for tests that need to seed it. */
export const PREFERRED_CITY_QUERY_KEY = ["preferred-city"] as const;

/** Reads the stored city. A missing value, an empty string or an unavailable
 * store (web) all mean the same thing: this device has no chosen city. */
async function readStoredCity(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(PREFERRED_CITY_KEY);
    const trimmed = stored?.trim();
    return trimmed ? trimmed : null;
  } catch {
    // Storage unavailable — behave like "nothing chosen yet".
    return null;
  }
}

/**
 * The city stored on this device, plus the "we don't know yet" window.
 *
 * `isHydrating` is `isLoading`, not `isPending`: this query is never disabled,
 * but the distinction is the one that bit us before (a disabled query is
 * `isPending` forever) and the rule is worth keeping visible.
 */
export function usePreferredCity(): { city: string | null; isHydrating: boolean } {
  const query = useQuery<string | null>({
    queryKey: PREFERRED_CITY_QUERY_KEY,
    queryFn: readStoredCity,
    // Read once per app run: the cache entry IS the source of truth afterwards,
    // and every write below updates both it and the store.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return { city: query.data ?? null, isHydrating: query.isLoading };
}

/**
 * Records the guest's pick on this device.
 *
 * The cache is updated SYNCHRONOUSLY so the header and every city-scoped query
 * react on the same tap; the store write is fire-and-forget, because a failed
 * write only costs the choice a restart, it must not block the switch.
 *
 * `cancelQueries` first: on a cold start the hydration read may still be in
 * flight, and without cancelling it, its (older) answer would land after this
 * write and undo the pick.
 *
 * `null` — the picker's "clear" row — means "no city chosen on this device",
 * which hands the decision back to the profile city and then to the fallback.
 */
export function useSetPreferredCity(): (city: string | null) => void {
  const queryClient = useQueryClient();

  return useCallback(
    (city: string | null) => {
      const trimmed = city?.trim();
      const value = trimmed ? trimmed : null;

      void queryClient.cancelQueries({ queryKey: PREFERRED_CITY_QUERY_KEY });
      queryClient.setQueryData(PREFERRED_CITY_QUERY_KEY, value);

      void (async () => {
        try {
          if (value) {
            await SecureStore.setItemAsync(PREFERRED_CITY_KEY, value);
          } else {
            await SecureStore.deleteItemAsync(PREFERRED_CITY_KEY);
          }
        } catch {
          // Storage unavailable (e.g. web) — the choice still applies for this
          // session; it just does not survive a restart.
        }
      })();
    },
    [queryClient],
  );
}
