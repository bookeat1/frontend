import type { VenueSchedule } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dayHoursLabel,
  openState,
  openStateLabel,
  openUntilTodayLabel,
  scheduleDayFor,
  uniformDailyHours,
  venueDayOfWeek,
} from "../schedule";

/**
 * REGRESSION GUARD — «Открыто сейчас» belongs to the server.
 *
 * The deleted bug: the client parsed the FIRST and LAST "HH:MM" out of the
 * free-text `opening_hours` string, applied that one range to all seven days,
 * and compared it against the PHONE's clock — and when the string did not
 * parse it answered «открыто». On live data that lied in three different ways
 * at once ("Пн — Чт: 12:00–01:00, Пт — Сб: 12:00–03:00" became one 12:00–03:00
 * regime; "Чт, Пт, Сб 19:00-24:00" became a seven-day-a-week venue; a venue
 * closed on Sunday showed «Открыто»).
 *
 * These tests hold the line where it matters: openness comes from
 * `schedule.open_now`, computed server-side in the VENUE's timezone, and the
 * free-text string can never produce it.
 */

const t = getDictionary();

/** The schedule of a venue that really is open Thu–Sat 19:00–24:00 and closed
 * the other four days — «Adept» on the live catalog. Its free-text string
 * ("Чт, Пт, Сб 19:00-24:00") used to be read as a seven-day-a-week regime. */
function adeptSchedule(openNow: boolean | null): VenueSchedule {
  return {
    timezone: "Asia/Almaty",
    openNow,
    days: [4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek: dayOfWeek as 4 | 5 | 6,
      isOpen: true,
      opensAt: "19:00",
      closesAt: "00:00",
      closesNextDay: true,
    })),
  };
}

describe("open-now comes from the server, whatever the device clock says", () => {
  // The companion half of this guarantee — that a free-text `opening_hours`
  // string can never produce a schedule at all — is pinned in
  // packages/api/src/__tests__/http-mapping.test.ts.
  it("the phone's clock cannot flip the answer", () => {
    vi.useFakeTimers();
    try {
      // 20:00 in Almaty — squarely inside the venue's own text hours. The
      // server says closed; the server wins.
      vi.setSystemTime(new Date("2026-07-30T15:00:00.000Z"));
      expect(openState(adeptSchedule(false))).toBe("closed");
      // 04:00 in Almaty — far outside them. `open_now: true` still wins.
      vi.setSystemTime(new Date("2026-07-30T23:00:00.000Z"));
      expect(openState(adeptSchedule(true))).toBe("open");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a venue with no schedule at all is 'unknown', not 'open'", () => {
    // THE ME'ET on the live catalog: the backend refused to parse its hours
    // string, so the `schedule` key is absent from the payload entirely.
    expect(openState(null)).toBe("unknown");
    expect(openStateLabel(null)).toBe(t.restaurant.hoursUnknownShort);
    expect(openStateLabel(null)).not.toBe(t.restaurant.openNow);
  });

  it("having days but no open_now is still 'unknown'", () => {
    expect(openState(adeptSchedule(null))).toBe("unknown");
  });
});

describe("three states, not two", () => {
  it("open / closed / unknown are all distinct", () => {
    expect(openState({ timezone: "Asia/Almaty", openNow: true, days: [] })).toBe("open");
    expect(openState({ timezone: "Asia/Almaty", openNow: false, days: [] })).toBe("closed");
    expect(openState({ timezone: "Asia/Almaty", openNow: null, days: [] })).toBe("unknown");
    expect(openState(null)).toBe("unknown");
  });

  it("«не знаем» is never rendered as «Закрыто»", () => {
    expect(openStateLabel(null)).not.toBe(t.restaurant.closedNow);
    expect(openStateLabel({ timezone: "Asia/Almaty", openNow: null, days: [] })).not.toBe(
      t.restaurant.closedNow,
    );
  });

  it("a day the server did not mention reads differently from a day off", () => {
    const schedule = {
      timezone: "Asia/Almaty",
      openNow: true,
      days: [{ dayOfWeek: 1 as const, isOpen: false, opensAt: null, closesAt: null, closesNextDay: false }],
    };
    expect(dayHoursLabel(scheduleDayFor(schedule, 1))).toBe(t.restaurant.schedule.dayOff);
    expect(dayHoursLabel(scheduleDayFor(schedule, 3))).toBe(t.restaurant.schedule.unknownDay);
    expect(t.restaurant.schedule.dayOff).not.toBe(t.restaurant.schedule.unknownDay);
  });
});

describe("work past midnight reads as thirteen hours, not one", () => {
  const day = (over: Partial<{ opensAt: string; closesAt: string; closesNextDay: boolean }>) => ({
    dayOfWeek: 4 as const,
    isOpen: true,
    opensAt: "12:00",
    closesAt: "01:00",
    closesNextDay: true,
    ...over,
  });

  it("marks the closing time as belonging to the next day", () => {
    expect(dayHoursLabel(day({}))).toBe(t.restaurant.schedule.rangeNextDay("12:00", "01:00"));
  });

  // The «(полночь)» suffix was dropped on 2026-08-24 — the column shows hours
  // only. The BRANCH still exists (untilMidnight is its own dictionary key), so
  // the literal is asserted here as well: without it the test would pass even if
  // the suffix crept back in through the dictionary.
  it("midnight closing shows plain hours, with no «(полночь)» suffix", () => {
    expect(dayHoursLabel(day({ opensAt: "19:00", closesAt: "00:00" }))).toBe(
      t.restaurant.schedule.untilMidnight("19:00"),
    );
    expect(dayHoursLabel(day({ opensAt: "19:00", closesAt: "00:00" }))).toBe("19:00 – 00:00");
  });

  it("a same-day range is a plain range", () => {
    expect(dayHoursLabel(day({ closesAt: "23:00", closesNextDay: false }))).toBe(
      t.restaurant.schedule.range("12:00", "23:00"),
    );
  });
});

describe("compact hours block — «Открыто до 23:00» + «Ежедневно с 10:00 до 23:00»", () => {
  const everyDaySchedule = (openNow: boolean | null): VenueSchedule => ({
    timezone: "Asia/Almaty",
    openNow,
    days: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      isOpen: true,
      opensAt: "10:00",
      closesAt: "23:00",
      closesNextDay: false,
    })),
  });

  it("collapses seven identical days into one summary window", () => {
    expect(uniformDailyHours(everyDaySchedule(true))).toEqual({
      opensAt: "10:00",
      closesAt: "23:00",
      closesNextDay: false,
    });
  });

  it("returns null when hours vary, so the per-day breakdown is shown instead", () => {
    // Adept is open only Thu–Sat — the week is not uniform.
    expect(uniformDailyHours(adeptSchedule(true))).toBeNull();
    // A week missing even one day is not «ежедневно».
    const sixDays = everyDaySchedule(true);
    sixDays.days = sixDays.days.filter((day) => day.dayOfWeek !== 0);
    expect(uniformDailyHours(sixDays)).toBeNull();
    expect(uniformDailyHours(null)).toBeNull();
  });

  it("appends today's closing time to the server's «Открыто», never inventing openness", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-30T06:00:00.000Z")); // 11:00 in Almaty
      expect(openUntilTodayLabel(everyDaySchedule(true))).toBe(t.restaurant.openUntil("23:00"));
      // Server says closed → plain «Закрыто», no closing-time suffix.
      expect(openUntilTodayLabel(everyDaySchedule(false))).toBe(t.restaurant.closedNow);
      // Server silent → «часы работы не указаны», not «Открыто до …».
      expect(openUntilTodayLabel(everyDaySchedule(null))).toBe(t.restaurant.hoursUnknownShort);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("venueDayOfWeek — the only date arithmetic allowed here", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses the VENUE's timezone, not the device's", () => {
    // 2026-07-30T20:30Z is still Thursday in Almaty (UTC+5 → 01:30 Friday…),
    // pick a moment where the two zones disagree about the day.
    const moment = new Date("2026-07-30T19:30:00.000Z"); // Thu 19:30 UTC
    expect(venueDayOfWeek("Asia/Almaty", moment)).toBe(5); // Fri 00:30 local
    expect(venueDayOfWeek("Europe/Lisbon", moment)).toBe(4); // Thu 20:30 local
  });

  it("an unknown timezone falls back to the device day instead of throwing", () => {
    const moment = new Date("2026-07-30T12:00:00.000Z");
    expect(() => venueDayOfWeek("Not/AZone", moment)).not.toThrow();
    expect(venueDayOfWeek("", moment)).toBe(moment.getDay());
  });
});

/**
 * «Откроется в 10:00» — правка владельца 2026-08-24: голое «Закрыто» не
 * отвечает на единственный вопрос гостя, стоящего перед закрытой дверью.
 *
 * Строка приписывается ТОЛЬКО к серверному «закрыто» и только пока сегодняшнее
 * время открытия впереди. Ничего об открытости здесь по-прежнему не
 * вычисляется: `openNow` остаётся единственным источником.
 */
describe("closed venue that still opens today says WHEN", () => {
  const scheduleAt = (
    openNow: boolean | null,
    opensAt: string,
    timezone = "Asia/Almaty",
  ): VenueSchedule => ({
    timezone,
    openNow,
    days: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      isOpen: true,
      opensAt,
      closesAt: "23:00",
      closesNextDay: false,
    })),
  });

  // 2026-07-30T03:00Z = 08:00 в Алматы, до открытия.
  const beforeOpening = new Date("2026-07-30T03:00:00.000Z");
  // 2026-07-30T05:00Z = 10:00 в Алматы, после открытия в 09:00.
  const afterOpening = new Date("2026-07-30T05:00:00.000Z");
  // 2026-07-30T18:00Z = 23:00 в Алматы, вечер того же дня.
  const lateEvening = new Date("2026-07-30T18:00:00.000Z");

  it("appends today's opening time to the server's «Закрыто»", () => {
    expect(openUntilTodayLabel(scheduleAt(false, "10:00"), beforeOpening)).toBe(
      t.restaurant.opensAt("10:00"),
    );
  });

  it("says nothing about tomorrow once today's opening has passed", () => {
    expect(openUntilTodayLabel(scheduleAt(false, "10:00"), lateEvening)).toBe(
      t.restaurant.closedNow,
    );
  });

  /**
   * ГРАНИЦА ФОРМАТА ВРЕМЕНИ. Сравнение «ЧЧ:ММ» строками верно только с ведущим
   * нулём: без него «10:00» < «9:00» — правда, и закрытое в 10:00 заведение
   * пообещало бы открыться в 9:00, то есть в прошлом. Этот тест падает ровно
   * тогда, когда ведущий ноль потеряется по дороге (см. clockTime).
   */
  it("compares padded HH:MM, so 10:00 is AFTER 09:00 and not before", () => {
    expect(openUntilTodayLabel(scheduleAt(false, "09:00"), afterOpening)).toBe(
      t.restaurant.closedNow,
    );
    expect(openUntilTodayLabel(scheduleAt(false, "09:00"), beforeOpening)).toBe(
      t.restaurant.opensAt("09:00"),
    );
  });

  it("never turns «не знаем» or «открыто» into an opening promise", () => {
    expect(openUntilTodayLabel(scheduleAt(null, "10:00"), beforeOpening)).toBe(
      t.restaurant.hoursUnknownShort,
    );
    expect(openUntilTodayLabel(scheduleAt(true, "10:00"), beforeOpening)).toBe(
      t.restaurant.openUntil("23:00"),
    );
  });

  it("stays silent on a day off and on a timezone the engine cannot resolve", () => {
    const dayOff = scheduleAt(false, "10:00");
    dayOff.days = dayOff.days.map((day) => ({
      ...day,
      isOpen: false,
      opensAt: null,
      closesAt: null,
    }));
    expect(openUntilTodayLabel(dayOff, beforeOpening)).toBe(t.restaurant.closedNow);
    expect(openUntilTodayLabel(scheduleAt(false, "10:00", ""), beforeOpening)).toBe(
      t.restaurant.closedNow,
    );
  });
});

/**
 * ДИАПАЗОНЫ — ТИРЕ, А НЕ ДЕФИС (правка владельца 2026-08-24). Проверяется
 * кодовая точка, а не «похожий символ»: дефис-минус U+002D и тире U+2013
 * в исходнике на глаз неразличимы.
 */
describe("every «from–to» range uses an en dash", () => {
  const EN_DASH = "–";

  it("day hours are joined by U+2013", () => {
    const label = t.restaurant.schedule.range("10:00", "23:00");
    expect(label).toContain(EN_DASH);
    expect(label).not.toContain("-");
    expect(t.restaurant.schedule.rangeNextDay("12:00", "01:00")).toContain(EN_DASH);
    expect(t.restaurant.schedule.untilMidnight("19:00")).toContain(EN_DASH);
  });
});
