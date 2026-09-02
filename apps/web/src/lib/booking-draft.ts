import { GUEST_OPTIONS } from "@web/lib/booking-options";

/**
 * Черновик выбора в карточке брони: дата, число гостей и слот.
 *
 * ЗАЧЕМ. Гость выбирает субботу, четверых и 20:00, нажимает «Забронировать» и
 * уходит на `/login` вводить код. Возвращается он на ту же страницу, но
 * состояние карточки живёт в `useState` и умирает вместе с ней. Пустая карточка
 * после входа — это выбор, сделанный дважды, а на телефоне с плохой связью
 * ещё и доступность, загруженная дважды.
 *
 * ГДЕ. `sessionStorage`, а не `localStorage`: черновик нужен внутри одной
 * вкладки и одного визита. Вход идёт переходом в той же вкладке, и
 * `sessionStorage` его переживает; а назавтра, в новой вкладке, старая
 * суббота гостю не нужна — и не всплывёт.
 *
 * КЛЮЧ СОДЕРЖИТ ЗАВЕДЕНИЕ. Выбор для одного ресторана не должен всплыть на
 * странице другого: у того другие часы, и «20:00» из первого может не
 * существовать во втором. Слот при восстановлении всё равно сверяется с живой
 * выдачей доступности (см. `chosen` в карточке), но дата и гости приехали бы
 * чужие.
 *
 * ЧТЕНИЕ ПРОВЕРЯЕТ ВСЁ: хранилище — это ввод, а не доверенная память. Дата в
 * прошлом, гости вне списка, мусор вместо JSON — черновика нет.
 */
export interface BookingDraft {
  /** «YYYY-MM-DD». */
  date: string;
  guests: number;
  /** `startsAt` слота дословно, как пришёл с сервера, или null. */
  slot: string | null;
}

const PREFIX = "bookeat.web.booking-draft.";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Safari в приватном режиме БРОСАЕТ на обращении, а не отдаёт null.
    return null;
  }
}

function key(venueId: string): string {
  return `${PREFIX}${venueId}`;
}

/**
 * Черновик для заведения, если он есть и не устарел.
 *
 * `today` передаётся снаружи, а не считается здесь: у карточки уже есть
 * сегодняшняя дата, посчитанная после гидратации, и второй источник «сегодня»
 * в одном экране — это два разных «сегодня» в полночь.
 */
export function readBookingDraft(venueId: string, today: string): BookingDraft | null {
  const raw = storage()?.getItem(key(venueId));
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { date, guests, slot } = parsed as Record<string, unknown>;
  if (typeof date !== "string" || !DATE_RE.test(date)) return null;
  // Строки одного формата сравниваются как даты. Вчерашний черновик — не
  // черновик: поле даты не примет день раньше `min`, а запрос доступности на
  // прошлое бессмыслен.
  if (date < today) return null;
  if (typeof guests !== "number" || !(GUEST_OPTIONS as readonly number[]).includes(guests)) {
    return null;
  }
  if (slot !== null && typeof slot !== "string") return null;

  return { date, guests, slot };
}

export function writeBookingDraft(venueId: string, draft: BookingDraft): void {
  try {
    storage()?.setItem(key(venueId), JSON.stringify(draft));
  } catch {
    // Квота или запрет хранилища: карточка работает и без черновика.
  }
}

export function clearBookingDraft(venueId: string): void {
  try {
    storage()?.removeItem(key(venueId));
  } catch {
    // См. выше.
  }
}
