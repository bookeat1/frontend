/**
 * Одноразовый флаг «бронь создана, а предзаказ не прикрепился» —
 * `venue-menu-stepper-promo-card` (2026-09-06), A10/A14.
 *
 * `sessionStorage`, А НЕ АДРЕС: ссылку на `/bookings/[id]` можно переслать
 * (гость показывает её на входе), и уведомление «предзаказ не прикрепился» в
 * URL всплыло бы у КАЖДОГО, кто открыл ту же ссылку — в том числе у самого
 * гостя при повторном заходе (A14 требует «не показывается при повторном
 * открытии ссылки»). Флаг читается и СРАЗУ стирается — второй `GET` того же
 * ключа отвечает `false`.
 */

const PREFIX = "bookeat.web.preorder-failed.";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markPreorderFailed(bookingId: string): void {
  try {
    storage()?.setItem(`${PREFIX}${bookingId}`, "1");
  } catch {
    // Хранилище недоступно — уведомление просто не покажется. Бронь при этом
    // цела, это не потеря данных.
  }
}

/** Читает флаг и стирает его — второй вызов с тем же `bookingId` отвечает `false`. */
export function consumePreorderFailedFlag(bookingId: string): boolean {
  const key = `${PREFIX}${bookingId}`;
  const store = storage();
  const present = store?.getItem(key) === "1";
  try {
    store?.removeItem(key);
  } catch {
    // См. выше.
  }
  return present;
}
