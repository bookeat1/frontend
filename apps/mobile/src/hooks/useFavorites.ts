import {
  favoriteEventKey,
  type FavoriteItem,
  type FavoriteItems,
  type FavoriteKind,
} from "@bookeat/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useAuth } from "../lib/auth";
import { useRepository } from "../lib/repository";

/** Prefix of everything favorites. Invalidating it invalidates the item list
 * too (TanStack matches by key PREFIX), which is why a venue toggle needs no
 * second invalidation to keep the «Все» tab honest. */
export const FAVORITES_QUERY_KEY = ["favorites"] as const;

/** The one favorites request the app makes: venues, events and promos at once. */
export const FAVORITE_ITEMS_QUERY_KEY = ["favorites", "items"] as const;

/**
 * Everything the guest saved — `GET /favorites/items`, asked WITHOUT a `type`.
 *
 * One query for all three kinds on purpose: the server computes `counts` for
 * every kind regardless of the filter, so a single response renders the tab
 * row, its counters AND every tab's contents — switching a tab is a filter,
 * not a request. It also means one source of truth for every heart in the app
 * (venue, event, promo cards) instead of three lists that can disagree.
 *
 * Session-gated: the endpoint is on the authenticated group, so an anonymous
 * call is a guaranteed 401 rather than an empty list. The query stays disabled
 * until the session is known, and screens treat "signed out" as its own state.
 */
export function useFavoriteItems() {
  const repository = useRepository();
  const { status } = useAuth();

  return useQuery<FavoriteItems>({
    queryKey: FAVORITE_ITEMS_QUERY_KEY,
    queryFn: () => repository.getFavoriteItems(),
    enabled: status === "signed-in",
    // Favorites change only when this guest changes them, and every mutation
    // below invalidates the list itself.
    staleTime: 60_000,
  });
}

/**
 * Just the venue ids, for the heart on a venue card. Reads the SAME query as
 * the favorites screen, so the two can never disagree and a card costs no
 * extra request.
 */
export function useFavoriteIds(): Set<string> {
  const { data } = useFavoriteItems();
  return useMemo(
    () =>
      new Set(
        (data?.items ?? [])
          .filter((item): item is Extract<FavoriteItem, { kind: "restaurant" }> =>
            item.kind === "restaurant",
          )
          .map((item) => item.restaurant.id),
      ),
    [data],
  );
}

/**
 * Keys of the saved EVENTS, for the heart on an event card.
 *
 * ПОЧЕМУ КЛЮЧ, А НЕ id: повторяющееся событие сохраняется как СЕРИЯ. Сервер
 * отдаёт в избранном ближайшую будущую дату серии, и её `id` не совпадает с
 * `id` той даты, на которой гость нажал сердечко, — сравнение по `id` рисовало
 * бы пустое сердечко на уже сохранённой карточке. Ключ — `recurrence_id`,
 * когда он есть, и `id` у разового события (см. favoriteEventKey в @bookeat/api).
 */
export function useFavoriteEventKeys(): Set<string> {
  const { data } = useFavoriteItems();
  return useMemo(
    () =>
      new Set(
        (data?.items ?? [])
          .filter((item): item is Extract<FavoriteItem, { kind: "event" }> => item.kind === "event")
          .map((item) => favoriteEventKey(item.event)),
      ),
    [data],
  );
}

/** Ids of the saved PROMOS. A promo has no series, so the id is the key. */
export function useFavoritePromoIds(): Set<string> {
  const { data } = useFavoriteItems();
  return useMemo(
    () =>
      new Set(
        (data?.items ?? [])
          .filter((item): item is Extract<FavoriteItem, { kind: "promo" }> => item.kind === "promo")
          .map((item) => item.promo.id),
      ),
    [data],
  );
}

/** What one card's heart needs, whatever kind of card it is. */
export interface FavoriteToggle {
  isFavorite: boolean;
  toggle: () => void;
  /** The last attempt failed — the heart has already sprung back. */
  failed: boolean;
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
export function useRestaurantFavorite(restaurantId: string): FavoriteToggle {
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
    // Возвращаем промис инвалидации: пока он не разрешится, мутация считается
    // pending — сердечко всё это время показывает то, что попросил гость, и не
    // моргает в старое состояние между «сервер ответил» и «список перечитан».
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY }),
  });
}

/** What an event/promo toggle sends. `favorite` is the state ASKED for. */
export interface ToggleEntityFavoriteVariables {
  /** Event id (any occurrence of a series) or promo id. */
  id: string;
  /** Key this entity is known by in the cached list — for an event that is the
   * series, not the occurrence. */
  key: string;
  favorite: boolean;
}

/**
 * Adds / removes one EVENT or PROMO.
 *
 * Optimistic, with a real rollback: on "unsave" the item is removed from the
 * cached list and the counters are decremented immediately, so the row leaves
 * the «Избранное» screen under the guest's finger; if the request fails the
 * exact previous payload is put back and the row returns.
 *
 * On "save" the list is NOT edited: the server owns that row (it resolves a
 * recurring event to its nearest upcoming occurrence, and carries fields the
 * card in hand does not have), and splicing a locally-built entry in would
 * show data no server confirmed. The heart still fills immediately — that part
 * is driven by the in-flight mutation, see useEntityFavorite.
 */
export function useToggleEntityFavorite(kind: Exclude<FavoriteKind, "restaurant">) {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const { ensureFreshToken } = useAuth();

  return useMutation<void, unknown, ToggleEntityFavoriteVariables, { previous?: FavoriteItems }>({
    mutationFn: async ({ id, favorite }) => {
      await ensureFreshToken();
      if (kind === "event") {
        await (favorite
          ? repository.addEventFavorite(id)
          : repository.removeEventFavorite(id));
        return;
      }
      await (favorite ? repository.addPromoFavorite(id) : repository.removePromoFavorite(id));
    },
    onMutate: async ({ key, favorite }) => {
      if (favorite) return {};
      // Отменяем идущий рефетч: иначе он может приземлиться ПОСЛЕ нашей
      // оптимистичной правки и вернуть только что убранную строку.
      await queryClient.cancelQueries({ queryKey: FAVORITE_ITEMS_QUERY_KEY });
      const previous = queryClient.getQueryData<FavoriteItems>(FAVORITE_ITEMS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<FavoriteItems>(
          FAVORITE_ITEMS_QUERY_KEY,
          removeFavoriteItem(previous, kind, key),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      // Точный откат: возвращаем ровно тот payload, который был до правки.
      if (context?.previous) {
        queryClient.setQueryData<FavoriteItems>(FAVORITE_ITEMS_QUERY_KEY, context.previous);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY }),
  });
}

/**
 * Removes one event/promo from a cached payload and fixes the counters.
 *
 * Exported for the test: this is the only place the optimistic edit lives, and
 * an off-by-one in the counters would show up as a tab that says «2» over an
 * empty list.
 */
export function removeFavoriteItem(
  items: FavoriteItems,
  kind: Exclude<FavoriteKind, "restaurant">,
  key: string,
): FavoriteItems {
  const remaining = items.items.filter((item) => {
    if (item.kind !== kind) return true;
    return item.kind === "event" ? favoriteEventKey(item.event) !== key : item.promo.id !== key;
  });
  const removed = items.items.length - remaining.length;
  if (removed === 0) return items;
  return {
    items: remaining,
    counts: {
      ...items.counts,
      all: Math.max(0, items.counts.all - removed),
      events: kind === "event" ? Math.max(0, items.counts.events - removed) : items.counts.events,
      promos: kind === "promo" ? Math.max(0, items.counts.promos - removed) : items.counts.promos,
    },
  };
}

/**
 * The heart on an EVENT card.
 *
 * Compares by series where there is one: `favoriteEventKey` returns the
 * `recurrence_id` of a recurring event and the plain id of a one-off. Saving
 * still sends the occurrence id the guest is looking at — the server turns
 * that into the series itself.
 */
export function useEventFavorite(
  event: { id: string; recurrenceId: string | null } | null | undefined,
): FavoriteToggle {
  const savedKeys = useFavoriteEventKeys();
  return useEntityFavorite({
    kind: "event",
    id: event?.id ?? "",
    key: event ? favoriteEventKey(event) : "",
    savedKeys,
  });
}

/** The heart on a PROMO card. A promo has no series — the id is the key. */
export function usePromoFavorite(promoId: string | undefined): FavoriteToggle {
  const savedIds = useFavoritePromoIds();
  return useEntityFavorite({
    kind: "promo",
    id: promoId ?? "",
    key: promoId ?? "",
    savedIds,
  });
}

function useEntityFavorite({
  kind,
  id,
  key,
  savedKeys,
  savedIds,
}: {
  kind: Exclude<FavoriteKind, "restaurant">;
  id: string;
  key: string;
  savedKeys?: Set<string>;
  savedIds?: Set<string>;
}): FavoriteToggle {
  const { status } = useAuth();
  const router = useRouter();
  const mutation = useToggleEntityFavorite(kind);
  const saved = savedKeys ?? savedIds ?? new Set<string>();

  const isFavorite =
    mutation.isPending && mutation.variables ? mutation.variables.favorite : saved.has(key);

  const toggle = () => {
    // Одна заявка за раз: быстрый двойной тап не должен превращаться в гонку
    // PUT против DELETE, где побеждает тот, кто позже доехал до сервера.
    if (mutation.isPending || id === "") return;
    mutation.reset();
    if (status !== "signed-in") {
      // Намерение едет вместе с гостем: после входа экран сам досохраняет то,
      // на что уже нажали, — как это давно работает для заведений.
      router.push({
        pathname: "/auth/sign-in",
        params: { reason: "favorite", favoriteKind: kind, favoriteId: id },
      });
      return;
    }
    mutation.mutate({ id, key, favorite: !isFavorite });
  };

  return { isFavorite, toggle, failed: mutation.isError };
}
