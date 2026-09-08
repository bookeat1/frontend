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

/**
 * Стереть черновики ВСЕХ заведений. Зовёт `AuthProvider` на смене сессии
 * (вход, выход, отзыв токена) — там же, где чистится избранное.
 *
 * ЗАЧЕМ. Ключ черновика — только `venueId`, сессии в нём нет. Гость А набрал
 * имя и телефон, ушёл на вход и бросил (или вышел); Б в той же вкладке
 * открывает форму — и поля уже заполнены данными А. Профиль Б подставляется
 * ТОЛЬКО в пустые поля (черновик дороже профиля, см. `BookingScreen`), поэтому
 * бронь ушла бы с телефоном А, и заведение звонило бы не тому человеку.
 *
 * Почему чистка, а не `user.id` в ключе: профиль может быть `null` при живой
 * сессии, и два таких гостя подряд получили бы один и тот же ключ (см.
 * комментарий в `query-keys.ts`).
 *
 * Ключи собираются в список ДО удаления: `removeItem` сдвигает индексы, и
 * обход `for (i < length)` с удалением на лету пропускал бы каждый второй.
 */
export function clearAllBookingFormDrafts(): void {
  const store = storage();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const name = store.key(i);
      if (name?.startsWith(PREFIX)) keys.push(name);
    }
    for (const name of keys) store.removeItem(name);
  } catch {
    // См. выше.
  }
}
