import { birthDateBounds } from "./profile-edit";

/**
 * Дата рождения, НАБРАННАЯ ЦИФРАМИ.
 *
 * Правка владельца 2026-09-01: «дату можно указывать просто цифрами, без
 * вызова календаря». Календарь никуда не делся — он остался вторым способом,
 * — но человек, который помнит свой день рождения, больше не обязан листать
 * до 1990 года.
 *
 * Модуль намеренно ЧИСТЫЙ: ни React, ни словаря. Здесь живут ровно два
 * правила — как выглядит набранное и что оно значит, — и оба проверяются на
 * границе, а не через отрисованную форму.
 *
 * ГРАНИЦЫ ДАТЫ НЕ СВОИ. Диапазон берётся у `birthDateBounds`, то есть у той же
 * функции, которой пользуются валидатор профиля и календарь. Вторая копия
 * правила рано или поздно разъедется с сервером, и человек получит 422 вместо
 * подсказки.
 *
 * ФОРМАТ ОТПРАВКИ НЕ МЕНЯЕТСЯ: наружу отдаётся ключ даты «YYYY-MM-DD» — ровно
 * то, что `PATCH /users/me` разбирает через `time.Parse("2006-01-02")`.
 * «дд.мм.гггг» живёт только на экране.
 */

/**
 * Коды совпадают с ключами словаря `profile.edit.errors`, поэтому экран
 * печатает `t.profile.edit.errors[code]` и не заводит своего перевода.
 */
export type BirthDateInputError =
  | "birth_date_incomplete"
  | "birth_date_format"
  | "birth_date_not_past"
  | "birth_date_too_old";

export type BirthDateInputResult =
  /** Поле пустое — это НЕ ошибка: гость ещё не начал вводить. */
  | { status: "empty" }
  /** Цифр меньше восьми. Отдельный исход, а не «неверная дата»: «01.01.19» —
   * это ещё не ошибка человека, это незаконченный ввод. */
  | { status: "incomplete" }
  | { status: "invalid"; error: BirthDateInputError }
  | { status: "ok"; dateKey: string };

/** Сколько цифр в полной дате: 2 + 2 + 4. */
const FULL_LENGTH = 8;

/**
 * Приводит что угодно к виду «дд.мм.гггг»: оставляет только цифры, обрезает
 * лишние и сам расставляет точки.
 *
 * Хвостовой точки НЕ добавляем. Если после «04» дописать «.», то стереть её
 * станет невозможно: backspace убирает точку, маска возвращает её обратно, и
 * поле «залипает». Точка появляется вместе со СЛЕДУЮЩЕЙ цифрой.
 */
export function maskBirthDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, FULL_LENGTH);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter((part) => part.length > 0)
    .join(".");
}

/** Обратное преобразование: ключ даты «1990-05-04» → «04.05.1990». */
export function birthDateInputFromDateKey(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return "";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/**
 * Разбирает набранное. Проверяются ровно те четыре вещи, о которых спросил
 * владелец, и в этом порядке:
 *
 *  1. цифр меньше восьми — `incomplete`;
 *  2. такого дня не существует (31.02, 00.05, 45.13) — `birth_date_format`;
 *  3. дата в будущем — `birth_date_not_past`;
 *  4. дата старше 120 лет — `birth_date_too_old`.
 *
 * Пункт 2 нельзя доверить `new Date`: «2026-02-31» она молча превращает в
 * 3 марта. Поэтому разобранную дату сверяем с введённой строкой.
 */
export function parseBirthDateInput(text: string, now: Date): BirthDateInputResult {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 0) return { status: "empty" };
  if (digits.length < FULL_LENGTH) return { status: "incomplete" };

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const dateKey = `${year}-${month}-${day}`;

  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateKey) {
    return { status: "invalid", error: "birth_date_format" };
  }

  // Ключи дат сравниваются строками: «YYYY-MM-DD» сортируется хронологически
  // по построению, и это тот же приём, что в `validateProfileDraft`.
  const { earliest, latest } = birthDateBounds(now);
  if (dateKey > latest) return { status: "invalid", error: "birth_date_not_past" };
  if (dateKey < earliest) return { status: "invalid", error: "birth_date_too_old" };

  return { status: "ok", dateKey };
}
