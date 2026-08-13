import { addDays, toDateKey } from "./format";

/**
 * Значения для колёс «Гости» и «Дата» на экране поиска.
 *
 * Границы здесь не декоративные, они повторяют правила сервера:
 *   - гостей не больше MAX_GUESTS — выше этого сервер отвечает «это уже
 *     банкет, свяжитесь с заведением» (bookings.Config.DefaultMaxGuests = 20),
 *     и предлагать в колесе 30 значило бы обещать бронь, которой не будет;
 *   - дат ровно на HORIZON_DAYS вперёд — дальше горизонта бронирования
 *     (DefaultHorizonDays = 60) свободных столов не бывает по определению, и
 *     любой такой поиск вернул бы пусто без объяснения.
 *
 * Если серверные значения когда-нибудь разъедутся с этими, экран начнёт
 * предлагать заведомо пустые запросы — поэтому они названы и объяснены здесь,
 * а не вписаны числами в разметку.
 */

export const MAX_GUESTS = 20;
export const HORIZON_DAYS = 60;

export interface PickerOption {
  value: string;
  label: string;
}

export function guestOptions(label: (n: number) => string): PickerOption[] {
  return Array.from({ length: MAX_GUESTS }, (_, i) => ({
    value: String(i + 1),
    label: label(i + 1),
  }));
}

/**
 * Даты от сегодня на горизонт вперёд. Сегодня и завтра названы словами — это
 * то, как человек и думает о ближайших днях; остальные показываются как
 * «пятница, 21 августа».
 */
export function dateOptions(
  today: Date,
  labels: { today: string; tomorrow: string; format: (date: Date) => string },
): PickerOption[] {
  return Array.from({ length: HORIZON_DAYS + 1 }, (_, i) => {
    const date = addDays(today, i);
    let label = labels.format(date);
    if (i === 0) label = labels.today;
    if (i === 1) label = labels.tomorrow;
    return { value: toDateKey(date), label };
  });
}
