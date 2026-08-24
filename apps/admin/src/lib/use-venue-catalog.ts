"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { ApiPage, CatalogVenue, CatalogVenueInput } from "@bookeat/api/admin";

import { apiClient } from "./api";
import { useAuth } from "./auth-context";

/**
 * Каталог заведений — раздел суперадмина.
 *
 * Гейт тот же, что у «Платформы»: запрос вообще не уходит, если роль не
 * администратор платформы. Менеджеру заведения он вернул бы 403, а 403 на
 * экране читается как поломка, хотя это правильный ответ.
 *
 * В ключ запроса входит id пользователя — как в остальных хуках панели: два
 * аккаунта в одном браузере не должны на мгновение показать чужой список.
 */
export function useIsPlatformAdmin(): boolean {
  const { user, token } = useAuth();
  return Boolean(token) && user?.role === "admin";
}

/**
 * @param search подстрока названия — фильтрует СЕРВЕР (`name ILIKE '%…%'`)
 * @param city точное значение города — тоже сервер (`r.city = $1`). Кухни и
 *   статуса «показывается/скрыто» у этого эндпоинта нет вовсе (adminList читает
 *   только search/city/page/per_page), они отбираются в панели —
 *   см. `lib/venue-filters.ts`.
 */
export function useVenueCatalog(
  search: string,
  city = "",
): UseQueryResult<ApiPage<CatalogVenue>> {
  const { user } = useAuth();
  const enabled = useIsPlatformAdmin();
  return useQuery({
    queryKey: ["venue-catalog", user?.id ?? null, search, city],
    queryFn: () => apiClient.listCatalogVenues({ search, city, perPage: 100 }),
    enabled,
    // Каталог меняется руками и редко; лишний рефетч на каждый фокус вкладки
    // здесь только моргает списком.
    staleTime: 30_000,
  });
}

/** Создание, правка и скрытие — три мутации на один список: любая из них
 * инвалидирует его, чтобы строка обновилась ровно один раз и из ответа
 * сервера, а не из локальной догадки. */
export function useVenueMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["venue-catalog"] });

  const create = useMutation({
    mutationFn: (input: CatalogVenueInput) => apiClient.createVenue(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CatalogVenueInput }) =>
      apiClient.updateVenue(id, input),
    onSuccess: invalidate,
  });

  /** «Скрыть» и «Вернуть» — одна и та же правка флага, поэтому одна мутация:
   * скрытие через DELETE (мягкое, сервер снимает is_active), возврат — через
   * PATCH с is_active: true. */
  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      if (active) {
        await apiClient.updateVenue(id, { is_active: true });
        return;
      }
      await apiClient.deactivateVenue(id);
    },
    onSuccess: invalidate,
  });

  return { create, update, setActive };
}
