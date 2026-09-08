import { describe, expect, it } from "vitest";

import { bookingHref, bookingResultPath, menuHref, readBookingIntent } from "@web/lib/booking-link";

/**
 * Адрес страницы бронирования. Всё, что в нём едет, — ввод: `?guests=999` и
 * `?date=вчера` не должны доехать до запроса доступности.
 */
describe("bookingHref", () => {
  it("несёт только заданные части и не пишет пустые", () => {
    expect(bookingHref("venue-1")).toBe("/venues/venue-1/book");
    expect(bookingHref("venue-1", { date: "2026-08-25", guests: 4 })).toBe(
      "/venues/venue-1/book?date=2026-08-25&guests=4",
    );
    expect(
      bookingHref("venue-1", {
        date: "2026-08-25",
        guests: 2,
        slot: "2026-08-25T19:30:00+05:00",
        changeBookingId: "a1b2c3d4-0000-4000-8000-000000000001",
      }),
    ).toBe(
      "/venues/venue-1/book?date=2026-08-25&guests=2&slot=2026-08-25T19%3A30%3A00%2B05%3A00&change=a1b2c3d4-0000-4000-8000-000000000001",
    );
  });

  it("экранирует идентификатор заведения и отбрасывает мусор", () => {
    expect(bookingHref("a/b")).toBe("/venues/a%2Fb/book");
    expect(bookingHref("venue-1", { date: "25.08.2026", guests: 999, slot: "вечером", changeBookingId: "x" })).toBe(
      "/venues/venue-1/book",
    );
  });
});

describe("readBookingIntent", () => {
  it("возвращает то, что прошло проверку, и умолчания вместо остального", () => {
    const params = new URLSearchParams(
      "date=2026-08-25&guests=4&slot=2026-08-25T19%3A30%3A00%2B05%3A00&change=a1b2c3d4-0000-4000-8000-000000000001",
    );
    expect(readBookingIntent(params)).toEqual({
      date: "2026-08-25",
      guests: 4,
      slot: "2026-08-25T19:30:00+05:00",
      changeBookingId: "a1b2c3d4-0000-4000-8000-000000000001",
    });
    expect(readBookingIntent(new URLSearchParams("date=x&guests=0&slot=19:30&change=1"))).toEqual({
      date: null,
      guests: 2,
      slot: null,
      changeBookingId: null,
    });
  });

  it("адрес → разбор → адрес совпадает сам с собой", () => {
    const href = bookingHref("venue-1", { date: "2026-08-25", guests: 3, slot: "2026-08-25T20:00:00+05:00" });
    const intent = readBookingIntent(new URLSearchParams(href.split("?")[1]));
    expect(bookingHref("venue-1", intent)).toBe(href);
  });
});

/** B-WEB-1: вход на полное меню с текущим выбором даты/гостей/времени. */
describe("menuHref", () => {
  it("несёт date/guests/slot, но не change (B1-B3)", () => {
    expect(menuHref("venue-1")).toBe("/venues/venue-1/menu");
    expect(
      menuHref("venue-1", {
        date: "2026-08-25",
        guests: 4,
        slot: "2026-08-25T19:30:00+05:00",
        changeBookingId: "a1b2c3d4-0000-4000-8000-000000000001",
      }),
    ).toBe("/venues/venue-1/menu?date=2026-08-25&guests=4&slot=2026-08-25T19%3A30%3A00%2B05%3A00");
  });

  it("отбрасывает мусор так же, как bookingHref", () => {
    expect(menuHref("venue-1", { date: "25.08.2026", guests: 999, slot: "вечером" })).toBe(
      "/venues/venue-1/menu",
    );
  });

  it("bookingHref ↔ menuHref round-trip через readBookingIntent (B3)", () => {
    const bookHref = bookingHref("venue-1", { date: "2026-08-25", guests: 3, slot: "2026-08-25T20:00:00+05:00" });
    const intent = readBookingIntent(new URLSearchParams(bookHref.split("?")[1]));
    const goToMenu = menuHref("venue-1", intent);
    const backIntent = readBookingIntent(new URLSearchParams(goToMenu.split("?")[1]));
    expect(bookingHref("venue-1", backIntent)).toBe(bookHref);
  });
});

describe("bookingResultPath", () => {
  it("экранирует идентификатор", () => {
    expect(bookingResultPath("booking-1")).toBe("/bookings/booking-1");
    expect(bookingResultPath("a b")).toBe("/bookings/a%20b");
  });
});
