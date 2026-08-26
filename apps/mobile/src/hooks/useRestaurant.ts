import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useRepository } from "../lib/repository";
import { usePullToRefresh } from "./usePullToRefresh";

export function useRestaurant(id: string | undefined) {
  const repository = useRepository();
  return useQuery({
    queryKey: ["restaurant", id],
    queryFn: () => {
      if (!id) throw new Error("Missing restaurant id");
      return repository.getRestaurant(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * The card-sized view of one venue. Used where a screen needs only the name /
 * photo (the bookings list): it is ONE request, while `useRestaurant` fans out
 * to four to build the detail screen.
 *
 * Its own cache key on purpose — the two answers have different shapes, and
 * sharing a key would let the cheap read evict the expensive one.
 */
export function useRestaurantSummary(id: string | undefined) {
  const repository = useRepository();
  return useQuery({
    queryKey: ["restaurant-summary", id],
    queryFn: () => {
      if (!id) throw new Error("Missing restaurant id");
      return repository.getRestaurantSummary(id);
    },
    enabled: Boolean(id),
    // The catalog changes on an editorial timescale; a venue's name is not
    // worth re-reading every time a list scrolls back into view.
    staleTime: 5 * 60_000,
  });
}

/**
 * The venue's promo "stories" for the highlight rail. Its OWN cache key and
 * request on purpose: the rail is an optional strip that must degrade on its
 * own (empty array = hidden, error = hidden) without touching the
 * four-endpoint `useRestaurant` read that builds the rest of the screen.
 *
 * Same editorial staleTime as the summary — the pinned stories change no more
 * often than the catalog does.
 */
export function useRestaurantStories(id: string | undefined) {
  const repository = useRepository();
  return useQuery({
    queryKey: ["restaurant-stories", id],
    queryFn: () => {
      if (!id) throw new Error("Missing restaurant id");
      return repository.getRestaurantStories(id);
    },
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}

/**
 * Обновление экрана заведения жестом.
 *
 * Экран показывает ДВА независимых запроса: сам профиль заведения
 * (`useRestaurant` — меню, расписание, контакты) и ленту сторис
 * (`useRestaurantStories`). Обновить надо оба, а кружок обязан гореть до
 * последнего ответа — поэтому здесь `refetchQueries` с одним промисом, а не
 * два отдельных `refetch` (первый вернувшийся погасил бы индикатор).
 *
 * ФИЛЬТР — по id, а не по корню ключа: в кэше лежат и другие заведения
 * (гость листал каталог), и обновлять их, стоя на этом экране, значит тратить
 * сеть на то, чего на экране нет. `type: "active"` добавляет второе условие —
 * запрос смонтирован прямо сейчас.
 *
 * Избранное (`["favorites"]`) сюда НЕ входит: сердечко меняется только руками
 * этого же гостя, и его список перечитывается собственной мутацией. Тянуть
 * его жестом — обновлять то, что и так не могло разойтись.
 */
export function useRestaurantRefresh(id: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = useCallback(
    () =>
      queryClient.refetchQueries({
        type: "active",
        predicate: (query) => {
          const [root, key] = query.queryKey;
          if (key !== id) return false;
          return root === "restaurant" || root === "restaurant-stories";
        },
      }),
    [queryClient, id],
  );
  return usePullToRefresh(refresh, { enabled: Boolean(id) });
}
