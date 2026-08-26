import { describe, expect, it } from "vitest";
import {
  LUNCH_ENDS_HOUR,
  MORNING_ENDS_HOUR,
  TIME_OF_DAY_ORDER,
  parseTimeOfDay,
  timeOfDayOfHour,
  timeOfDayOfSlot,
  timeOfDayWindow,
} from "../time-of-day";

/**
 * Время суток — один словарь значений на экран брони и на фильтр каталога.
 * Проверяются ГРАНИЦЫ (утро строго до 12:00 — решение владельца) и окно,
 * которое из них получается для сервера.
 */
describe("время суток", () => {
  it("утро — строго до 12:00, дальше обед", () => {
    expect(timeOfDayOfHour(0)).toBe("morning");
    expect(timeOfDayOfHour(9)).toBe("morning");
    expect(timeOfDayOfHour(11)).toBe("morning");
    // Ровно 12:00 — уже обед, а не «конец утра».
    expect(timeOfDayOfHour(MORNING_ENDS_HOUR)).toBe("lunch");
  });

  it("обед кончается в 18:00 — граница та же, что была в экране брони", () => {
    expect(timeOfDayOfHour(17)).toBe("lunch");
    expect(timeOfDayOfHour(LUNCH_ENDS_HOUR)).toBe("dinner");
    expect(timeOfDayOfHour(23)).toBe("dinner");
  });

  it("порядок значений — по ходу дня", () => {
    expect([...TIME_OF_DAY_ORDER]).toEqual(["morning", "lunch", "dinner"]);
  });

  it("слот попадает в период по ЛОКАЛЬНОМУ часу начала", () => {
    // Собираем локальное время явно, чтобы тест не зависел от пояса машины.
    const at = (hour: number) => new Date(2026, 7, 26, hour, 0, 0).toISOString();
    expect(timeOfDayOfSlot(at(9))).toBe("morning");
    expect(timeOfDayOfSlot(at(13))).toBe("lunch");
    expect(timeOfDayOfSlot(at(20))).toBe("dinner");
  });

  it("окна не пересекаются и покрывают сутки целиком", () => {
    expect(timeOfDayWindow("morning")).toEqual({ timeFrom: "00:00", timeTo: "12:00" });
    expect(timeOfDayWindow("lunch")).toEqual({ timeFrom: "12:00", timeTo: "18:00" });
    expect(timeOfDayWindow("dinner")).toEqual({ timeFrom: "18:00", timeTo: "24:00" });
  });

  it("чужая строка не превращается в «утро»", () => {
    expect(parseTimeOfDay("morning")).toBe("morning");
    expect(parseTimeOfDay("breakfast")).toBeUndefined();
    expect(parseTimeOfDay(undefined)).toBeUndefined();
    expect(parseTimeOfDay(null)).toBeUndefined();
  });
});
