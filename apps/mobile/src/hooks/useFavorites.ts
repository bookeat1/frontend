import type { RestaurantSummary } from "@bookeat/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useAuth } from "../lib/auth";
import { useRepository } from "../lib/repository";

export const FAVORITES_QUERY_KEY = ["favorites"] as const;

/**
 * The guest's favorite venues (`GET /favorites`).
 *
 * Session-gated: the endpoint is on the authenticated group, so an anonymous
 * call is a guaranteed 401 rather than an empty list. The query therefore
 * stays disabled until the session is known, and the screens treat
 * "signed out" as its own state instead of as an error.
 */
export function useFavorites() {
  const repository = useRepository();
  const { status } = useAuth();

  return useQuery<RestaurantSummary[]>({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: () => repository.getFavorites(),
    enabled: status === "signed-in",
    // Favorites change only when this guest changes them, and the mutation
    // below invalidates the list itself.
    staleTime: 60_000,
  });
}

/**
 * Just the ids, for the heart on a card. Reads the SAME query as the list
 * screen, so the two can never disagree and a card costs no extra request.
 */
export function useFavoriteIds(): Set<string> {
  const { data } = useFavorites();
  return useMemo(() => new Set((data ?? []).map((restaurant) => restaurant.id)), [data]);
}

/**
 * Everything one venue card's heart needs: the current state, the tap handler,
 * and whether the last attempt failed.
 *
 * A signed-out guest is sent to the sign-in screen instead of having the heart
 * fill locally: favorites live on the account, and a heart that fills and then
 * silently forgets is exactly the lie this replaced.
 *
 * While a toggle is in flight the heart shows what the guest ASKED for, and it
 * falls back to the server's answer if the request fails — so a failure is
 * visible as the heart springing back, not only as the message next to it.
 */
export function useRestaurantFavorite(restaurantId: string): {
  isFavorite: boolean;
  toggle: () => void;
  failed: boolean;
} {
  const { status } = useAuth();
  const router = useRouter();
  const favoriteIds = useFavoriteIds();
  const mutation = useToggleFavorite();

  const isFavorite =
    mutation.isPending && mutation.variables
      ? mutation.variables.favorite
      : favoriteIds.has(restaurantId);

  const toggle = () => {
    // One request at a time per card: a rapid double tap must not race a PUT
    // against a DELETE for the same venue, where the winner is whichever
    // reaches the server last.
    if (mutation.isPending) return;
    // Clears a previous failure so the message next to the heart belongs to
    // the attempt the guest just made.
    mutation.reset();
    if (status !== "signed-in") {
      // The intent travels with the guest: the sign-in screen adds this venue
      // to the favorites itself once the session exists, so the heart the
      // guest already tapped is not asked for a second time.
      router.push({
        pathname: "/auth/sign-in",
        params: { reason: "favorite", restaurantId },
      });
      return;
    }
    mutation.mutate({ restaurantId, favorite: !isFavorite });
  };

  return { isFavorite, toggle, failed: mutation.isError };
}

export interface ToggleFavoriteVariables {
  restaurantId: string;
  /** The state the guest is asking for, not the current one. */
  favorite: boolean;
}

/**
 * Adds / removes one venue.
 *
 * Both endpoints are idempotent server-side (PUT on an already-favorited venue
 * answers 200, DELETE on a missing one likewise), so a double tap cannot
 * produce an error — the worst case is one wasted request.
 *
 * No optimistic edit of the cached LIST: the heart lives on a card that holds
 * a `RestaurantSummary`, but the list is the server's own payload, and
 * splicing a locally-built entry into it would show a row the server has not
 * confirmed. The button renders its own in-flight state instead, and the list
 * is invalidated once the server has agreed.
 */
export function useToggleFavorite() {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const { ensureFreshToken } = useAuth();

  return useMutation<void, unknown, ToggleFavoriteVariables>({
    mutationFn: async ({ restaurantId, favorite }) => {
      await ensureFreshToken();
      if (favorite) {
        await repository.addFavorite(restaurantId);
        return;
      }
      await repository.removeFavorite(restaurantId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
    },
  });
}
