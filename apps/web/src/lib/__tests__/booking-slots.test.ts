import { describe, expect, it } from "vitest";
import type { AvailabilitySlot } from "@bookeat/api/client";

import { availableCount, emptyKind, groupSlots } from "@web/lib/booking-slots";

function slot(startsAt: string, overrides: Partial<AvailabilitySlot> = {}): AvailabilitySlot {
  return { startsAt, endsAt: startsAt, available: true, freeTables: 1, reason: null, ...overrides };
}

const taken = (startsAt: string, reason: AvailabilitySlot["reason"]) =>
  slot(startsAt, { available: false, freeTables: 0, reason });

/**
 * Четыре разные пустоты, а не одна: совет гостю в каждом случае свой.
 */
describe("emptyKind", () => {
  it("различает «нет часов», «нет столика на компанию», «поздно» и «занято»", () => {
    expect(emptyKind([])).toBe("day");
    expect(emptyKind([taken("2026-08-25T19:00:00+05:00", "capacity")])).toBe("capacity");
    expect(emptyKind([taken("2026-08-25T19:00:00+05:00", "too_soon")])).toBe("late");
    expect(
      emptyKind([taken("2026-08-25T19:00:00+05:00", "occupied"), taken("2026-08-25T20:00:00+05:00", "capacity")]),
    ).toBe("taken");
  });

  it("свободный слот — не пустота, даже среди занятых", () => {
    expect(emptyKind([taken("2026-08-25T19:00:00+05:00", "occupied"), slot("2026-08-25T20:00:00+05:00")])).toBeNull();
  });
});

describe("availableCount", () => {
  it("считает ТОЛЬКО свободные: `freeTables` сигналом не является", () => {
    expect(
      availableCount([
        slot("2026-08-25T19:00:00+05:00", { freeTables: 0 }),
        taken("2026-08-25T19:30:00+05:00", "occupied"),
        slot("2026-08-25T20:00:00+05:00"),
      ]),
    ).toBe(2);
  });
});

/**
 * Границы групп в макете противоречивы («19:00» в «Вечере», «19:30» уже в
 * «Позднем вечере»), поэтому выбраны в коде: день до 17:00, вечер до 21:00,
 * ночь принадлежит позднему вечеру.
 */
describe("groupSlots", () => {
  it("раскладывает по границам 17:00 и 21:00, ночь — к позднему вечеру", () => {
    const groups = groupSlots([
      slot("2026-08-25T12:00:00+05:00"),
      slot("2026-08-25T16:59:00+05:00"),
      slot("2026-08-25T17:00:00+05:00"),
      slot("2026-08-25T20:59:00+05:00"),
      slot("2026-08-25T21:00:00+05:00"),
      slot("2026-08-26T00:30:00+05:00"),
    ]);
    expect(groups.map((group) => [group.key, group.slots.map((item) => item.startsAt.slice(11, 16))])).toEqual([
      ["day", ["12:00", "16:59"]],
      ["evening", ["17:00", "20:59"]],
      ["late", ["21:00", "00:30"]],
    ]);
  });

  it("пустые группы не возвращает и порядок сервера внутри группы не меняет", () => {
    const groups = groupSlots([slot("2026-08-25T20:00:00+05:00"), slot("2026-08-25T18:00:00+05:00")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("evening");
    expect(groups[0].slots.map((item) => item.startsAt.slice(11, 16))).toEqual(["20:00", "18:00"]);
  });

  it("неразобранное время попадает в первую группу, а не теряется", () => {
    const groups = groupSlots([slot("вечером")]);
    expect(groups).toEqual([{ key: "day", slots: [slot("вечером")] }]);
  });
});
