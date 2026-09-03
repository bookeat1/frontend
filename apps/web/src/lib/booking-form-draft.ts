/**
 * Черновик КОНТАКТНОЙ части формы бронирования: имя, телефон, e-mail,
 * пожелания и выбранные чипы.
 *
 * ЗАЧЕМ. Гость заполняет страницу сверху вниз и только у кнопки узнаёт, что
 * бронь на сайте именная и нужен вход. Он уходит на `/login`, вводит код,
 * возвращается — и находит пустые поля вместо набранного абзаца пожеланий.
 * Это тот же тупик, что и «имя берётся из профиля, а профиль пуст», только
 * растянутый на два экрана.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ МОДУЛЬ, А НЕ ПОЛЯ В `booking-draft`. Тот черновик пишет
 * КАРТОЧКА в правой колонке страницы заведения при каждом изменении даты,
 * гостей и слота. Она про контакты ничего не знает, и её запись затирала бы
 * их целиком. Два ключа — два независимых писателя.
 *
 * ГДЕ. `sessionStorage`, по той же причине, что и у выбора времени: черновик
 * нужен внутри одной вкладки и одного визита, вход идёт переходом в той же
 * вкладке, а назавтра чужой набранный текст всплывать не должен.
 *
 * ЧТЕНИЕ ПРОВЕРЯЕТ ВСЁ: хранилище — это ввод, а не доверенная память.
 */

export interface BookingFormDraft {
  name: string;
  /** Национальные цифры номера, как их держит поле (см. `lib/phone.ts`), —
   * не E.164: в поле гость видит и правит именно их. */
  phoneDigits: string;
  email: string;
  notes: string;
  /** Идентификаторы нажатых чипов быстрых пожеланий. */
  wishes: string[];
}

const PREFIX = "bookeat.web.booking-form.";

/** Потолок на каждое текстовое поле при чтении. Хранилище открыто любой
 * вкладке того же домена, и мегабайт в поле имени — это не черновик. */
const MAX_TEXT = 2000;

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

function text(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_TEXT) : "";
}

export function readBookingFormDraft(venueId: string): BookingFormDraft | null {
  const raw = storage()?.getItem(key(venueId));
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { name, phoneDigits, email, notes, wishes } = parsed as Record<string, unknown>;
  return {
    name: text(name),
    // Только цифры: в поле всё равно попадут они, а буквы из чужой записи
    // сломали бы маску.
    phoneDigits: text(phoneDigits).replace(/\D/g, ""),
    email: text(email),
    notes: text(notes),
    wishes: Array.isArray(wishes)
      ? wishes.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [],
  };
}

export function writeBookingFormDraft(venueId: string, draft: BookingFormDraft): void {
  try {
    storage()?.setItem(key(venueId), JSON.stringify(draft));
  } catch {
    // Квота или запрет хранилища: форма работает и без черновика.
  }
}

export function clearBookingFormDraft(venueId: string): void {
  try {
    storage()?.removeItem(key(venueId));
  } catch {
    // См. выше.
  }
}
