/**
 * Время суток — ОДИН источник правды для всего приложения (2026-08-26).
 *
 * Три значения: «Утро», «Обед», «Ужин». Раньше их было два, и жили они прямо
 * в экране брони (`LUNCH_ENDS_HOUR = 18` + `isLunchSlot`), поэтому добавить
 * третье значило бы завести вторую, слегка другую границу в шторке фильтров.
 * Границы лежат здесь, в домене, а не в экранах: одно и то же слово должно
 * означать одно и то же время и в сетке слотов, и в запросе к каталогу.
 *
 * ГРАНИЦЫ (решение владельца, 2026-08-26):
 *   утро  — строго ДО 12:00;
 *   обед  — с 12:00 до 18:00;
 *   ужин  — с 18:00 и до конца суток.
 *
 * Это ГРУППИРОВКА, а не график заведения: у каждого заведения свои часы, а
 * здесь только способ не показывать двадцать времён одной колонкой и не
 * заставлять гостя набирать «с 09:00 до 12:00» руками.
 */

export type TimeOfDay = "morning" | "lunch" | "dinner";

/** Порядок, в котором значения показываются человеку — по ходу дня. */
export const TIME_OF_DAY_ORDER: readonly TimeOfDay[] = ["morning", "lunch", "dinner"];

/** Утро кончается в 12:00. */
export const MORNING_ENDS_HOUR = 12;
/** Обед кончается в 18:00 (та самая граница, что была в экране брони). */
export const LUNCH_ENDS_HOUR = 18;

/** Какому времени суток принадлежит ЛОКАЛЬНЫЙ час (0–23). */
export function timeOfDayOfHour(hour: number): TimeOfDay {
  if (hour < MORNING_ENDS_HOUR) return "morning";
  if (hour < LUNCH_ENDS_HOUR) return "lunch";
  return "dinner";
}

/**
 * Какому времени суток принадлежит слот. Час берётся ЛОКАЛЬНЫЙ — тот же, что
 * гость видит на кнопке слота, иначе вечерний слот заведения из другого пояса
 * попал бы в «Утро».
 */
export function timeOfDayOfSlot(startsAt: string): TimeOfDay {
  return timeOfDayOfHour(new Date(startsAt).getHours());
}

/**
 * Окно "HH:MM", которое уходит СЕРВЕРУ параметрами `time_from`/`time_to`
 * (см. backend internal/transport/rest/restaurants/handler.go:
 * `availabilityFilter`). Границы полуинтервальные, как и в `timeOfDayOfHour`:
 * слот в 12:00 — это обед, а не утро.
 *
 * Верхняя граница ужина — "24:00": сервер принимает ровно 24*60 минут
 * (`clockMinutes` пропускает `mins <= 24*60`), и это честнее, чем "23:59",
 * которое выкинуло бы слот ровно в полночь.
 */
export function timeOfDayWindow(period: TimeOfDay): { timeFrom: string; timeTo: string } {
  switch (period) {
    case "morning":
      return { timeFrom: "00:00", timeTo: hhmm(MORNING_ENDS_HOUR) };
    case "lunch":
      return { timeFrom: hhmm(MORNING_ENDS_HOUR), timeTo: hhmm(LUNCH_ENDS_HOUR) };
    case "dinner":
      return { timeFrom: hhmm(LUNCH_ENDS_HOUR), timeTo: "24:00" };
  }
}

/** Читает значение, пришедшее строкой (параметр маршрута, старый черновик
 * фильтров), и возвращает undefined на всём, что не является временем суток —
 * а не молча подставляет «утро». */
export function parseTimeOfDay(raw: string | undefined | null): TimeOfDay | undefined {
  return raw === "morning" || raw === "lunch" || raw === "dinner" ? raw : undefined;
}

function hhmm(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
