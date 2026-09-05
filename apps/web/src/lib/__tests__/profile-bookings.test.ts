import { describe, expect, it } from "vitest";

import { booking } from "@web/test/harness";
import { canChange, canShowCode, countVisits, splitBySegment, statusPill } from "@web/lib/profile-bookings";

const now = new Date("2026-08-20T12:00:00Z");

describe("сегменты броней профиля", () => {
  it("делит по статусу и по концу визита, активные — ближайшая первой", () => {
    const future = booking({ id: "b", status: "confirmed", startsAt: "2026-08-25T14:30:00Z", endsAt: "2026-08-25T16:00:00Z" });
    const sooner = booking({ id: "a", status: "pending", startsAt: "2026-08-21T14:30:00Z", endsAt: "2026-08-21T16:00:00Z" });
    const expired = booking({ id: "c", status: "confirmed", startsAt: "2026-08-01T14:30:00Z", endsAt: "2026-08-01T16:00:00Z" });
    const done = booking({ id: "d", status: "completed", endsAt: "2026-08-02T16:00:00Z" });
    const cancelled = booking({ id: "e", status: "cancelled" });
    const noShow = booking({ id: "f", status: "no_show", endsAt: "2026-08-03T16:00:00Z" });

    const split = splitBySegment([future, sooner, expired, done, cancelled, noShow], now);
    expect(split.active.map((b) => b.id)).toEqual(["a", "b"]);
    expect(split.past.map((b) => b.id)).toEqual(["c", "d"]);
    expect(split.cancelled.map((b) => b.id)).toEqual(["e", "f"]);
  });

  it("истёкшая подтверждённая бронь помечается «истекла», а не «подтверждено»", () => {
    const expired = booking({ status: "confirmed", endsAt: "2026-08-01T16:00:00Z" });
    expect(statusPill(expired, now)).toEqual({ key: "expired", tone: "neutral" });
    expect(canShowCode(expired, now)).toBe(false);
    expect(canChange(expired, now)).toBe(false);
  });

  it("код показывается только у подтверждённой активной, изменить — у ожидающей тоже", () => {
    const confirmed = booking({ status: "confirmed", endsAt: "2026-08-25T16:00:00Z" });
    const pending = booking({ status: "pending", endsAt: "2026-08-25T16:00:00Z" });
    expect(canShowCode(confirmed, now)).toBe(true);
    expect(canShowCode(pending, now)).toBe(false);
    expect(canChange(pending, now)).toBe(true);
    expect(statusPill(pending, now).tone).toBe("warning");
  });

  it("визиты — только состоявшиеся", () => {
    expect(countVisits([booking({ status: "completed" }), booking({ status: "arrived" }), booking({ status: "cancelled" }), booking()])).toBe(2);
  });
});
