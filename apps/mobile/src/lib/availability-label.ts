import { getDictionary } from "@bookeat/i18n";
import { dateOptions, type PickerOption } from "./availability-options";
import { fromDateKey } from "./format";

/**
 * Как называется выбранный день в подборе «дата · гости».
 *
 * Один источник на два места: капсулу внутри шторки фильтров
 * (`AvailabilityBar`) и чип применённого подбора над выдачей поиска. Раньше
 * подпись жила только в капсуле; когда тот же день понадобилось показать
 * чипом, второй расчёт разошёлся бы с первым на первых же двух днях — «12
 * августа» в чипе против «Сегодня» в капсуле для одной и той же даты.
 *
 * Даты за горизонтом брони (их в колесе нет) показываются как «12 августа» —
 * это не «неизвестно», а просто день, которого нет в списке.
 */
export interface DateChoices {
  /** Значения колеса дат — сегодня и дальше на горизонт брони. */
  options: PickerOption[];
  labelFor: (dateKey: string) => string;
}

export function dateChoices(today: Date): DateChoices {
  const t = getDictionary();
  const options = dateOptions(today, {
    today: t.booking.today,
    tomorrow: t.booking.tomorrow,
    format: (date) =>
      date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" }),
  });
  const byKey = new Map(options.map((option) => [option.value, option.label]));
  return {
    options,
    labelFor: (dateKey) =>
      byKey.get(dateKey) ??
      fromDateKey(dateKey).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }),
  };
}
