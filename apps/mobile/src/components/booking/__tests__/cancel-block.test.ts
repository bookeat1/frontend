import type { Booking } from "@bookeat/api";
import { canGuestCancel, isCancellableBookingStatus } from "@bookeat/api";
import { describe, expect, it } from "vitest";

/**
 * Блок отмены на экране брони.
 *
 * Экран показывает блок по `isCancellableBookingStatus` (бронь жива), а кнопку
 * внутри включает по `canGuestCancel` (жива И до визита больше двух часов).
 * Проверяется именно РАСХОЖДЕНИЕ этих двух условий: 21.08.2026 владелец
 * открыл бронь на сегодня в 11:00 около 09:09 и не нашёл блока вовсе —
 * двухчасовое окно уже закрылось, и блок исчезал целиком. Пропавший блок
 * читается как потерянная кнопка, а не как правило, поэтому теперь он
 * остаётся и объясняет себя словами.
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
});
