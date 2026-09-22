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
 * известных акций (`KNOWN_CAMPAIGN_IDS`), а не просто с форматом UUID —
 * подробности источника переменных у самой константы ниже.
 */

const STORAGE_KEY = "bookeat.web.campaignAttribution.v1";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * UUID акций, которые реально существуют на бэкенде — «Марафон Алматы»
 * (миграция 0107) и любые следующие. Публичные значения, зашиваются в бандл
 * как и `NEXT_PUBLIC_API_URL`.
 *
 * `NEXT_PUBLIC_KNOWN_CAMPAIGN_IDS` — список через запятую, основной источник
 * для ЛЮБОГО количества акций (21.09.2026, вторая акция добавлена именно
 * сюда). `NEXT_PUBLIC_MARATHON_PROMO_ID` читается ДОПОЛНИТЕЛЬНО, только для
 * обратной совместимости с уже развёрнутыми конфигурациями. Обе переменные
 * пустые/не заданы — пустой список, атрибуция тихо выключается, а не падает.
 */
/** Pure parser, exported so tests can exercise every combination of the two
 * env vars without reloading the module / touching real `process.env`. */
export function parseKnownCampaignIds(
  listEnv: string | undefined,
  legacyEnv: string | undefined,
): readonly string[] {
  const fromList = (listEnv ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(legacyEnv ? [...fromList, legacyEnv] : fromList));
}

export const KNOWN_CAMPAIGN_IDS: readonly string[] = parseKnownCampaignIds(
  process.env.NEXT_PUBLIC_KNOWN_CAMPAIGN_IDS,
  process.env.NEXT_PUBLIC_MARATHON_PROMO_ID,
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

/**
 * Захватить `?promo=` при заходе на сайт, если он там есть, и запомнить на
 * сессию. Идемпотентно: заход БЕЗ параметра не стирает уже захваченную метку
 * — гость может кликнуть с промо-ссылки на первую страницу и уйти дальше по
 * сайту без параметра в адресе, метка должна остаться с ним.
 *
 * Возвращает id акции, если он был НОВЫЙ (не было метки вовсе, или лежала
 * другая) — по этому значению `AnalyticsProvider` шлёт `deep_link_attributed`
 * ровно один раз. Повторный вызов с той же меткой (перезаход по той же
 * ссылке в той же сессии) отдаёт `null`: писать в хранилище нечего и событие
 * уже ушло в первый раз.
 */
export function captureCampaignFromUrl(
  search: string,
  knownIds: readonly string[] = KNOWN_CAMPAIGN_IDS,
): string | null {
  const promo = extractPromoFromSearch(search, knownIds);
  if (!promo) return null;
  if (readCampaignAttribution() === promo) return null;
  const s = storage();
  if (!s) return null;
  try {
    s.setItem(STORAGE_KEY, promo);
  } catch {
    // Хранилище недоступно (квота/приватный режим) — сессия просто идёт без
    // атрибуции. `deep_link_attributed` не должен уйти, если метка не легла:
    // событие означает «метка принята», а не «в URL что-то было».
    return null;
  }
  return promo;
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
