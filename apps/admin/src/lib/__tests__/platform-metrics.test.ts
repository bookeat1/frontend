import { describe, expect, it } from "vitest";
import type { PlatformBookings } from "@bookeat/api/admin";

import {
  comparisonRanges,
  countByStatus,
  deltaPercent,
  formatDelta,
  formatRate,
  lostBookings,
  lostRatePercent,
  totalBookings,
} from "../platform-metrics";

/**
 * Каждое число на этом экране — повод к действию («отмены выросли, иду к
 * заведению»). Поэтому здесь проверяется ровно то, что нельзя показывать:
 * выдуманный рост там, где сравнивать не с чем, и ноль там, где данных не было.
 */

function breakdown(rows: Record<string, number>, total?: number): PlatformBookings {
  const by_status = Object.entries(rows).map(([status, count]) => ({ status, count }));
  return {
    from: "2026-08-01",
    to: "2026-08-12",
    total: total ?? by_status.reduce((s, r) => s + r.count, 0),
    by_status,
  } as PlatformBookings;
}

describe("comparisonRanges", () => {
  const today = new Date("2026-08-12T10:00:00Z");

  it("текущее окно включает сегодня и тянется на N дней назад", () => {
    expect(comparisonRanges(7, today).current).toEqual({ from: "2026-08-06", to: "2026-08-12" });
  });

  it("предыдущее окно той же длины и вплотную перед текущим, без нахлёста", () => {
    const { current, previous } = comparisonRanges(7, today);
    expect(previous).toEqual({ from: "2026-07-30", to: "2026-08-05" });
    expect(previous.to < current.from).toBe(true);
  });

  it("месяц сравнивается с равными 30 днями, а не с календарным месяцем", () => {
    const { current, previous } = comparisonRanges(30, today);
    expect(current).toEqual({ from: "2026-07-14", to: "2026-08-12" });
    expect(previous).toEqual({ from: "2026-06-14", to: "2026-07-13" });
  });

  it("окно, перешагивающее границу года, считается корректно", () => {
    const { current, previous } = comparisonRanges(7, new Date("2027-01-03T00:00:00Z"));
    expect(current.from).toBe("2026-12-28");
    expect(previous).toEqual({ from: "2026-12-21", to: "2026-12-27" });
  });
});

describe("deltaPercent и его подпись", () => {
  it("считает рост и падение в целых процентах", () => {
    expect(deltaPercent(120, 100)).toBe(20);
    expect(deltaPercent(80, 100)).toBe(-20);
    expect(deltaPercent(100, 100)).toBe(0);
  });

  it("сравнивать не с чем — это прочерк, а не «+100%»", () => {
    expect(deltaPercent(5, 0)).toBeNull();
    expect(formatDelta(deltaPercent(5, 0))).toBe("—");
  });

  it("ноль отличается от прочерка: «столько же» и «не с чем сравнить» — разные факты", () => {
    expect(formatDelta(0)).toBe("0%");
    expect(formatDelta(null)).toBe("—");
  });

  it("подпись печатается с настоящим минусом, а не с дефисом", () => {
    expect(formatDelta(-8)).toBe("−8%");
    expect(formatDelta(12)).toBe("+12%");
  });
});

describe("брони: всего, потери и их доля", () => {
  const rows = breakdown({ confirmed: 70, completed: 20, cancelled: 8, no_show: 2 });

  it("отмены и неявки считаются вместе — для заведения это одно и то же", () => {
    expect(lostBookings(rows)).toBe(10);
    expect(lostRatePercent(rows)).toBe(10);
  });

  it("доля округляется до десятой", () => {
    expect(lostRatePercent(breakdown({ confirmed: 2, cancelled: 1 }))).toBe(33.3);
    expect(formatRate(33.3)).toBe("33,3%");
  });

  it("пустой период — прочерк: «никто не отменял» и «никто не бронировал» разные вещи", () => {
    expect(lostRatePercent(breakdown({}))).toBeNull();
    expect(lostRatePercent(undefined)).toBeNull();
    expect(formatRate(null)).toBe("—");
  });

  it("верит серверному total, но переживает его отсутствие", () => {
    expect(totalBookings(breakdown({ confirmed: 3 }, 99))).toBe(99);
    expect(totalBookings(breakdown({ confirmed: 3, cancelled: 1 }, 0))).toBe(4);
  });

  it("неизвестный статус не роняет счёт и не считается потерей", () => {
    const withUnknown = breakdown({ confirmed: 5, teleported: 3 });
    expect(totalBookings(withUnknown)).toBe(8);
    expect(lostBookings(withUnknown)).toBe(0);
    expect(countByStatus(withUnknown, "teleported")).toBe(3);
    expect(countByStatus(withUnknown, "pending")).toBe(0);
  });
});
