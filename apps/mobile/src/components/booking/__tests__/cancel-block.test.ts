import type { Booking } from "@bookeat/api";
import { canGuestCancel, hasVisitStarted, isCancellableBookingStatus } from "@bookeat/api";
import { describe, expect, it } from "vitest";

/**
 * Блок отмены на экране брони.
 *
 * Экран показывает блок по `isCancellableBookingStatus && !hasVisitStarted`
 * (бронь жива И визит ещё не наступил), а кнопку внутри включает
 * `canGuestCancel` — тоже только по статусу.
 *
 * БЫЛО (до правки 29.09.2026, «объединение окна»): `canGuestCancel` ещё
 * смотрела на время — за два часа до визита кнопка выключалась (решение
 * владельца 18.08.2026, инцидент с бронью на 11:00, замеченный в 09:09).
 * Это правило снято: сервер разрешает гостю отменить бронь в любой момент,
 * пока статус живой (`usecase/bookings/status.go` `authorizeTransition`), а
 * `restaurants.free_cancel_window_minutes` решает только вопрос денег
 * (`describeCancellationCost`), не доступность кнопки. Тест ниже проверяет
 * текущее, а не историческое поведение.
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
  it("статус живой, вне зависимости от времени до визита: и блок, и кнопка доступны", () => {
    const live = booking({});

    expect(isCancellableBookingStatus(live.status)).toBe(true);
    expect(canGuestCancel(live)).toBe(true);
  });

  it("у отменённой брони блока нет вовсе: отменять нечего", () => {
    const dead = booking({ status: "cancelled" });

    expect(isCancellableBookingStatus(dead.status)).toBe(false);
    expect(canGuestCancel(dead)).toBe(false);
  });

  it("время визита ещё не наступило: hasVisitStarted молчит, блок остаётся", () => {
    const now = new Date("2026-08-21T04:09:00Z");
    const live = booking({});

    expect(hasVisitStarted(live, now)).toBe(false);
  });

  it("время визита наступило (или прошло), а статус остался живым: блок должен пропасть целиком", () => {
    const startedNow = booking({ status: "confirmed" });
    expect(hasVisitStarted(startedNow, new Date(startedNow.startsAt))).toBe(true);

    const pastNow = new Date(Date.parse(startedNow.startsAt) + 60 * 60 * 1000);
    const arrivedButLate = booking({ status: "arrived" });
    expect(hasVisitStarted(arrivedButLate, pastNow)).toBe(true);
    // Кнопка сама по себе (по статусу) всё ещё была бы включена — блок
    // прячется целиком отдельным условием `!hasVisitStarted` на экране, а не
    // потому что `canGuestCancel` вдруг стала false.
    expect(canGuestCancel(arrivedButLate)).toBe(true);
  });

  it("нечитаемое время визита не прячет блок — решает статус/сервер", () => {
    const brokenDate = booking({ startsAt: "not-a-date" });
    expect(hasVisitStarted(brokenDate)).toBe(false);
    expect(canGuestCancel(brokenDate)).toBe(true);
  });
});
