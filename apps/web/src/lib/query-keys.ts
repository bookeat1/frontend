import type { QueryClient } from "@tanstack/react-query";

/**
 * Ключи кэша, ПРИВЯЗАННЫЕ К СЕССИИ.
 *
 * Лежат отдельным модулем, а не в `queries.ts`, по скучной причине: чистит их
 * `AuthProvider`, а `queries.ts` сам импортирует `useAuth` — импорт в обе
 * стороны замкнул бы модули друг на друга.
 *
 * Почему вообще ЧИСТКА, а не идентификатор гостя в составе ключа (второй
 * очевидный способ): профиль может быть НЕИЗВЕСТЕН при живой сессии. В
 * `completeSignIn` падение `GET /me` намеренно не отменяет вход — токены на
 * месте, гость вошёл, а `user` остаётся `null`. Ключ вида
 * `["favorites", user?.id]` у двух таких сессий подряд совпал бы, и утечка
 * вернулась бы ровно в том виде, ради которого затевалось разделение. Смена же
 * сессии проходит ТОЛЬКО через `AuthProvider` (вход, выход, отзыв токена по
 * 400/401/422), поэтому чистка в одной точке накрывает все случаи, включая тот,
 * где идентификатора нет.
 */
export const FAVORITES_KEY = ["favorites"] as const;

/**
 * Префикс ключа одной брони: `[...BOOKING_KEY, id]`. Бронь — такие же данные
 * сессии, как избранное: в ней телефон гостя, а адрес `/bookings/<id>` лежит
 * в истории вкладки, и следующий вошедший дотянется до него кнопкой «Назад».
 * `removeQueries` по префиксу снимает все брони разом, какой бы `id` ни был.
 */
export const BOOKING_KEY = ["booking"] as const;

/**
 * Список броней гостя (`GET /bookings`) на странице профиля. Отдельный ключ,
 * а не `[...BOOKING_KEY, "list"]`: тот префикс — про ОДНУ бронь по id, и
 * строка «list» на месте id читалась бы как бронь с таким идентификатором.
 */
export const MY_BOOKINGS_KEY = ["my-bookings"] as const;

/** Префикс ключа предзаказа одной брони: `[...PREORDER_KEY, bookingId]` —
 * та же строка блюд, что и билет брони, поэтому чистится вместе с ним. */
export const PREORDER_KEY = ["preorder"] as const;

/** Префикс ключа «живого» платежа брони (`GET /bookings/:id/payment`):
 * `[...BOOKING_PAYMENT_KEY, bookingId]`. Как и предзаказ — данные сессии,
 * чистятся вместе с бронью. */
export const BOOKING_PAYMENT_KEY = ["booking-payment"] as const;

/** Всё, что нельзя показывать следующему гостю в этой же вкладке. */
const SESSION_SCOPED_KEYS: readonly (readonly string[])[] = [
  FAVORITES_KEY,
  BOOKING_KEY,
  MY_BOOKINGS_KEY,
  PREORDER_KEY,
  BOOKING_PAYMENT_KEY,
];

/**
 * Персонализация v1 (спека `foodie-personalization-v1-20260916.md`, §3.9) —
 * `usePicks`/`useEvents`(на главной)/`usePromotions` в `queries.ts` ключуются
 * как `[locale, "picks", city]`/`[locale, "events", city, "for_you"]`/
 * `[locale, "promotions", city]`: `locale` — переменный первый элемент, а не
 * фиксированный корень, поэтому префиксное совпадение из
 * `SESSION_SCOPED_KEYS` их не поймает — нужен предикат по ВТОРОМУ элементу.
 * Эти ключи, в отличие от избранного/брони, существуют и для анонима (там
 * просто нет `mode`/`match`/сортировки по вкусу) — чистить их нужно на КАЖДЫЙ
 * переход сессии, не только на выход (PR #232 review, 2026-09-16: иначе
 * анонимный/чужой ряд «Выбрали для вас» и его сортировка доживают до входа
 * следующего гостя в пределах `staleTime`, пока не подоспеет перезапрос).
 *
 * `"promotions"`, НЕ `"promos-feed"` (второй раунд ревью, 2026-09-16—
 * первая версия этого набора перепутала их): `usePromotions` читает
 * `GET /feed` — персонализированную ленту главной на OptionalAuth (тот же
 * `tastematch.Loader`, что у picks/events), а `"promos-feed"` — это
 * `usePromosFeed` → `GET /promos`, обычный публичный список без гостя
 * вообще (см. `internal/bootstrap/app.go` в bookeat-backend — у ручки
 * promos нет UserID). Чистка `"promos-feed"` была безвредной, но ничего не
 * защищала: ряд «Акции» на главной оставался на ключе `"promotions"`.
 */
const SESSION_SENSITIVE_SECOND_SEGMENTS: ReadonlySet<string> = new Set([
  "picks",
  "events",
  "promotions",
]);

/**
 * Выбросить данные прежней сессии.
 *
 * Именно `removeQueries`, а не `invalidateQueries`: пометка «устарело» не
 * стирает СОДЕРЖИМОЕ, и до конца перезапроса экран продолжал бы показывать
 * чужие закрашенные сердца. А после выхода перезапроса не будет вовсе —
 * `useFavoriteIds` выключен без сессии, — и «устаревшие» данные остались бы на
 * экране навсегда.
 *
 * Вызывается на КАЖДЫЙ переход сессии (вход и выход) — см. doc-комментарий у
 * `SESSION_SENSITIVE_SECOND_SEGMENTS` про то, почему одной чистки на выход
 * здесь недостаточно, в отличие от избранного/брони выше.
 */
export function forgetSessionScopedQueries(client: QueryClient): void {
  for (const queryKey of SESSION_SCOPED_KEYS) {
    client.removeQueries({ queryKey });
  }
  client.removeQueries({
    predicate: (query) => {
      const second = query.queryKey[1];
      return typeof second === "string" && SESSION_SENSITIVE_SECOND_SEGMENTS.has(second);
    },
  });
}
