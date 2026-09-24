import type { Booking } from "@bookeat/api";
import { canGuestCancel, hasVisitStarted, isCancellableBookingStatus } from "@bookeat/api";
import { describe, expect, it } from "vitest";

/**
 * Блок отмены на экране брони.
 *
 * Экран показывает блок по `isCancellableBookingStatus && !hasVisitStarted`
 * (бронь жива И визит ещё не наступил), а кнопку внутри включает по
 * `canGuestCancel` (жива И до визита больше двух часов). Проверяется именно
 * РАСХОЖДЕНИЕ этих условий: 21.08.2026 владелец открыл бронь на сегодня в
 * 11:00 около 09:09 и не нашёл блока вовсе — двухчасовое окно уже закрылось,
 * и блок исчезал целиком. Пропавший блок читается как потерянная кнопка, а
 * не как правило, поэтому теперь он остаётся и объясняет себя словами — но
 * только ДО начала визита; как только время визита наступило, блок снова
 * пропадает целиком, потому что отменять уже нечего (см. `hasVisitStarted`).
 */

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: "b-1",
    restaurantId: "r-1",
    name: "Дамир",
    phone: "+77010000000",
    guests: 2,
    startsAt: "2026-08-21T06:00:00Z",
    endsAt: "2026-08-21T08:00:00Z",
    status: "pending",
    notes: null,
    freeCancelDeadline: null,
    createdAt: null,
    ...overrides,
  };
}

describe("блок отмены брони", () => {
  it("до визита меньше двух часов: блок есть, кнопка выключена", () => {
    // 04:09 UTC — ровно тот случай, что владелец увидел на устройстве.
    const now = new Date("2026-08-21T04:09:00Z");
    const live = booking({});

    expect(isCancellableBookingStatus(live.status)).toBe(true);
    expect(canGuestCancel(live, now)).toBe(false);
  });

  it("до визита больше двух часов: и блок, и кнопка", () => {
    const now = new Date("2026-08-21T03:00:00Z");
    const live = booking({});

    expect(isCancellableBookingStatus(live.status)).toBe(true);
    expect(canGuestCancel(live, now)).toBe(true);
  });

  it("у отменённой брони блока нет вовсе: отменять нечего", () => {
    const dead = booking({ status: "cancelled" });

    expect(isCancellableBookingStatus(dead.status)).toBe(false);
  });

  it("время визита ещё не наступило: hasVisitStarted молчит, блок остаётся", () => {
    const now = new Date("2026-08-21T04:09:00Z");
    const live = booking({});

    expect(hasVisitStarted(live, now)).toBe(false);
  });

  it("время визита наступило (или прошло), а статус остался живым: блок должен пропасть целиком", () => {
    // Тот же кейс владельца 18.08.2026, но дальше по времени: не «за два часа
    // до», а «визит уже начался», и заведение статус так и не перевело.
    const startedNow = booking({ status: "confirmed" });
    expect(hasVisitStarted(startedNow, new Date(startedNow.startsAt))).toBe(true);

    const pastNow = new Date(Date.parse(startedNow.startsAt) + 60 * 60 * 1000);
    const arrivedButLate = booking({ status: "arrived" });
    expect(hasVisitStarted(arrivedButLate, pastNow)).toBe(true);
    // Кнопка и до этого уже была бы выключена (окно давно закрылось) — но
    // теперь пропадает и сам блок.
    expect(canGuestCancel(arrivedButLate, pastNow)).toBe(false);
  });

  it("нечитаемое время визита не прячет блок — решает `canGuestCancel`/сервер", () => {
    const brokenDate = booking({ startsAt: "not-a-date" });
    expect(hasVisitStarted(brokenDate)).toBe(false);
  });
});
