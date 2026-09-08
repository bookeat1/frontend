/**
 * Одноразовый флаг «бронь создана, а предзаказ не прикрепился» —
 * `venue-menu-stepper-promo-card` (2026-09-06), A10/A14; расширен ПРИЧИНОЙ
 * отказа в D-WEB-1 (ТЗ `web-preorder-menu-20260908`, D5).
 *
 * `sessionStorage`, А НЕ АДРЕС: ссылку на `/bookings/[id]` можно переслать
 * (гость показывает её на входе), и уведомление «предзаказ не прикрепился» в
 * URL всплыло бы у КАЖДОГО, кто открыл ту же ссылку — в том числе у самого
 * гостя при повторном заходе (A14 требует «не показывается при повторном
 * открытии ссылки»). Флаг читается и СРАЗУ стирается — второй `GET` того же
 * ключа отвечает `null`.
 *
 * РАСШИРЕНИЕ, А НЕ ВТОРОЙ ФЛАГ (раздел 6 спеки, 🟡): значение было `"1"`,
 * стало `{ reason }`. Чтение принимает и старый `"1"` (читается как `"other"`),
 * чтобы билет, открытый посреди раскатки этой правки, не потерял уведомление.
 */

export type PreorderFailedReason = "below_minimum" | "item_unavailable" | "locked" | "other";

const KNOWN_REASONS: readonly PreorderFailedReason[] = [
  "below_minimum",
  "item_unavailable",
  "locked",
  "other",
];

function isKnownReason(value: unknown): value is PreorderFailedReason {
  return typeof value === "string" && (KNOWN_REASONS as readonly string[]).includes(value);
}

const PREFIX = "bookeat.web.preorder-failed.";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markPreorderFailed(bookingId: string, reason: PreorderFailedReason = "other"): void {
  try {
    storage()?.setItem(`${PREFIX}${bookingId}`, JSON.stringify({ reason }));
  } catch {
    // Хранилище недоступно — уведомление просто не покажется. Бронь при этом
    // цела, это не потеря данных.
  }
}

/**
 * Читает флаг и стирает его — второй вызов с тем же `bookingId` отвечает
 * `null`. Возвращает причину или `null` («флага не было»).
 *
 * ВСЁ ИЛИ НИЧЕГО НАОБОРОТ: сам факт присутствия ключа — это уже «предзаказ не
 * прикрепился», это записал только наш код. Нечитаемое значение (испорченный
 * JSON, будущий формат) НЕ трактуется как «флага нет» — тогда гость остался
 * бы без единственного слова объяснения; это `"other"`, самая общая причина.
 */
export function consumePreorderFailedFlag(bookingId: string): PreorderFailedReason | null {
  const key = `${PREFIX}${bookingId}`;
  const store = storage();
  const raw = store?.getItem(key) ?? null;
  try {
    store?.removeItem(key);
  } catch {
    // См. выше.
  }
  if (raw === null) return null;
  if (raw === "1") return "other";
  try {
    const parsed = JSON.parse(raw) as { reason?: unknown };
    if (isKnownReason(parsed?.reason)) return parsed.reason;
  } catch {
    // Испорченный JSON — см. комментарий функции.
  }
  return "other";
}
