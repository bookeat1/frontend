/**
 * Веб-аналог мобильной атрибуции кампаний («Марафон Алматы» и следующие
 * QR-акции) — см. `apps/mobile/src/lib/campaign-attribution.ts` для полного
 * разбора формата. Владелец подтвердил (09.09.2026): бронировать по акции
 * можно и с сайта, не только из приложения, а Detour SDK на вебе не заведён
 * вовсе — поэтому схема проще: печатный QR/ссылка ведёт на
 * `book-eat.com/...?promo=<uuid>`, гость заходит по ней, значение читается из
 * адресной строки и переживает остаток сессии в `sessionStorage`.
 *
 * `sessionStorage`, А НЕ `localStorage` (тот же выбор, что у
 * `preorder-failed-flag.ts`, по просьбе задачи): акция должна засчитываться,
 * пока гость бронирует в ЭТОМ заходе на сайт, а не месяцами спустя с чужого
 * визита на том же браузере.
 *
 * ИМЯ ПОЛЯ `promo` СОВПАДАЕТ с параметром, который читает мобильная ссылка
 * Detour, и с `CreateBookingInput.promotionId` → `promotion_id` на бэкенде —
 * единое имя на всех трёх концах, как просил Дамир.
 *
 * ИЗВЕСТНЫЕ АКЦИИ. С 10.09.2026 backend проверяет не только формат
 * `promotion_id`, но и то, что акция реально существует — случайный или
 * чужой UUID в адресе тоже роняет бронь (та же логика, что в мобильном
 * `campaign-attribution.ts`). Поэтому `?promo=` сверяется со списком
 * известных акций (`KNOWN_CAMPAIGN_IDS`, сейчас — только
 * `NEXT_PUBLIC_MARATHON_PROMO_ID`), а не просто с форматом UUID.
 */

const STORAGE_KEY = "bookeat.web.campaignAttribution.v1";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** UUID акций, которые реально существуют на бэкенде — сейчас «Марафон
 * Алматы» (миграция 0107). Публичное значение (просто идентификатор промо),
 * зашивается в бандл как и `NEXT_PUBLIC_API_URL`. Пустая переменная (сборка
 * без неё) даёт пустой список — атрибуция тихо выключается, а не падает. */
export const KNOWN_CAMPAIGN_IDS: readonly string[] = [process.env.NEXT_PUBLIC_MARATHON_PROMO_ID].filter(
  (id): id is string => Boolean(id),
);

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * `?promo=<uuid>` из строки запроса → id акции, или `null`. Значение не из
 * списка известных акций (опечатка, будущий формат ссылки, чужой UUID) НЕ
 * сохраняется: `POST /bookings` отвечает 422 на нераспознанный
 * `promotion_id`, а бронь по акции не должна ломаться из-за брака в
 * маркетинговой ссылке — гость просто бронирует без атрибуции.
 */
export function extractPromoFromSearch(
  search: string,
  knownIds: readonly string[] = KNOWN_CAMPAIGN_IDS,
): string | null {
  const promo = new URLSearchParams(search).get("promo");
  return promo && isUuid(promo) && knownIds.includes(promo) ? promo : null;
}

/** Захватить `?promo=` при заходе на сайт, если он там есть, и запомнить на
 * сессию. Идемпотентно: заход БЕЗ параметра не стирает уже захваченную метку
 * — гость может кликнуть с промо-ссылки на первую страницу и уйти дальше по
 * сайту без параметра в адресе, метка должна остаться с ним. */
export function captureCampaignFromUrl(
  search: string,
  knownIds: readonly string[] = KNOWN_CAMPAIGN_IDS,
): void {
  const promo = extractPromoFromSearch(search, knownIds);
  if (!promo) return;
  try {
    storage()?.setItem(STORAGE_KEY, promo);
  } catch {
    // Хранилище недоступно — сессия просто идёт без атрибуции.
  }
}

/** Метка текущей сессии, если она есть. `null` — обычный гость без акции, не
 * ошибка. */
export function readCampaignAttribution(): string | null {
  try {
    return storage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}
