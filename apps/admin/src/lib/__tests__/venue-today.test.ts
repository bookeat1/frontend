import { describe, expect, it } from "vitest";

import { formatBookingDay, formatWaiting, telHref } from "../venue-today";

/**
 * The operational block's formatting. What breaks here breaks for a person:
 * a request that has been ignored for two hours must not read as «ждёт 125 мин»
 * (nobody converts that at a glance), and a request for tomorrow evening must
 * not look like one for tonight.
 */

describe("formatWaiting", () => {
  it("prints whole minutes below an hour", () => {
    expect(formatWaiting(0)).toBe("ждёт 0 мин");
    expect(formatWaiting(1)).toBe("ждёт 1 мин");
    expect(formatWaiting(7)).toBe("ждёт 7 мин");
  });

  it("switches to hours exactly at 60, not before", () => {
    expect(formatWaiting(59)).toBe("ждёт 59 мин");
    expect(formatWaiting(60)).toBe("ждёт 1 ч");
    expect(formatWaiting(61)).toBe("ждёт 1 ч 1 мин");
    expect(formatWaiting(125)).toBe("ждёт 2 ч 5 мин");
  });

  it("switches to days exactly at 24 hours and declines the word", () => {
    expect(formatWaiting(1439)).toBe("ждёт 23 ч 59 мин");
    expect(formatWaiting(1440)).toBe("ждёт 1 день");
    expect(formatWaiting(2 * 1440)).toBe("ждёт 2 дня");
    expect(formatWaiting(5 * 1440)).toBe("ждёт 5 дней");
    expect(formatWaiting(11 * 1440)).toBe("ждёт 11 дней");
  });

  it("never prints a negative or fractional wait", () => {
    // The server promises non-negative whole minutes; a broken payload must
    // degrade to «0 мин», not to «ждёт -3 мин».
    expect(formatWaiting(-3)).toBe("ждёт 0 мин");
    expect(formatWaiting(7.9)).toBe("ждёт 7 мин");
    expect(formatWaiting(Number.NaN)).toBe("ждёт 0 мин");
  });
});

describe("formatBookingDay", () => {
  // TZ is pinned to Asia/Almaty in vitest.setup.ts, so these local wall-clock
  // strings mean what they read as.
  const now = new Date("2026-07-28T23:50:00+05:00");

  it("calls the reader's own calendar day «сегодня»", () => {
    expect(formatBookingDay("2026-07-28T19:30:00+05:00", now)).toBe("сегодня");
  });

  it("crosses to «завтра» on the calendar date, not after 24 hours", () => {
    // 40 minutes away, but a different date: the hostess reads the day, not the
    // distance.
    expect(formatBookingDay("2026-07-29T00:30:00+05:00", now)).toBe("завтра");
  });

  it("keeps the date for anything further out", () => {
    expect(formatBookingDay("2026-07-30T20:00:00+05:00", now)).not.toBe("завтра");
    expect(formatBookingDay("2026-07-30T20:00:00+05:00", now)).toContain("30");
  });

  it("does not render Invalid Date", () => {
    expect(formatBookingDay("not-a-date", now)).toBe("—");
  });
});

describe("telHref", () => {
  it("strips everything the dialer cannot take, keeping the leading plus", () => {
    expect(telHref("+7 (701) 000-00-00")).toBe("tel:+77010000000");
    expect(telHref("87010000000")).toBe("tel:87010000000");
  });

  it("returns an empty target for a phone with no digits, so no dead link", () => {
    expect(telHref("")).toBe("");
    expect(telHref("—")).toBe("");
  });
});
