import type { RestaurantSummary, TasteMatchReason } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { describe, expect, it } from "vitest";
import { matchChipText, matchReasonLabel, visibleMatchReasons } from "../match-reason-label";

/**
 * Чип причин «Для вас» (персонализация v1, критерий 21): максимум ДВЕ
 * причины, только `points > 0`, кухня — по имени из `params.cuisine_codes`
 * НА ЭТОЙ ЖЕ карточке, бюджет — знак яруса заведения.
 */

const t = getDictionary("ru");

function restaurant(overrides: Partial<RestaurantSummary> = {}): RestaurantSummary {
  return {
    id: "r1",
    name: "Тестовое заведение",
    cuisines: [
      { id: "italian", name: "Итальянская" },
      { id: "seafood", name: "Морепродукты" },
    ],
    priceLevel: "₸₸",
    rating: 0,
    reviewsCount: 0,
    address: "",
    city: "Алматы",
    description: "",
    schedule: null,
    acceptsOnlineBookings: false,
    ...overrides,
  };
}

describe("visibleMatchReasons", () => {
  it("без match — пусто", () => {
    expect(visibleMatchReasons(undefined)).toEqual([]);
  });

  it("отбрасывает нулевые причины и fallback_popular", () => {
    const reasons: TasteMatchReason[] = [
      { code: "cuisine_match", points: 400, params: { cuisine_codes: ["italian"] }, detail: "" },
      { code: "diet_match", points: 0, detail: "no diet data for venue" },
      { code: "fallback_popular", points: 0, detail: "" },
    ];
    expect(visibleMatchReasons(reasons)).toEqual([reasons[0]]);
  });

  it("не больше ДВУХ причин, даже если сервер прислал больше с очками", () => {
    const reasons: TasteMatchReason[] = [
      { code: "cuisine_match", points: 400, detail: "" },
      { code: "budget_match", points: 200, detail: "" },
      { code: "popular", points: 50, detail: "" },
    ];
    expect(visibleMatchReasons(reasons)).toEqual([reasons[0], reasons[1]]);
  });
});

describe("matchReasonLabel", () => {
  it("cuisine_match — имя кухни из пересечения params.cuisine_codes с кухнями ЭТОЙ карточки", () => {
    const reason: TasteMatchReason = {
      code: "cuisine_match",
      points: 400,
      params: { cuisine_codes: ["italian"] },
      detail: "",
    };
    expect(matchReasonLabel(reason, restaurant(), t)).toBe("Итальянская");
  });

  it("cuisine_match_implicit — тот же принцип", () => {
    const reason: TasteMatchReason = {
      code: "cuisine_match_implicit",
      points: 200,
      params: { cuisine_codes: ["seafood"] },
      detail: "",
    };
    expect(matchReasonLabel(reason, restaurant(), t)).toBe("Морепродукты");
  });

  it("код без кухни в params (или код не нашёлся на этой карточке) — общий текст, не пусто", () => {
    const reason: TasteMatchReason = { code: "cuisine_match", points: 400, detail: "" };
    expect(matchReasonLabel(reason, restaurant(), t)).toBe(t.explore.matchReasonCuisineFallback);
  });

  it("budget_match — знак яруса ЗАВЕДЕНИЯ, не гостя", () => {
    const reason: TasteMatchReason = { code: "budget_match", points: 200, detail: "" };
    expect(matchReasonLabel(reason, restaurant({ priceLevel: "₸₸₸" }), t)).toBe("₸₸₸");
  });

  it("остальные коды 5.3 — фиксированный общий текст по коду", () => {
    const cases: [string, string][] = [
      ["diet_match", t.explore.matchReasonDiet],
      ["booked_similar", t.explore.matchReasonBookedSimilar],
      ["editorial_pick", t.explore.matchReasonEditorial],
      ["venue_rating", t.explore.matchReasonRating],
      ["popular", t.explore.matchReasonPopular],
    ];
    for (const [code, expected] of cases) {
      expect(matchReasonLabel({ code, points: 10, detail: "" }, restaurant(), t)).toBe(expected);
    }
  });

  it("незнакомый будущий код — общий текст, не пустая строка", () => {
    expect(matchReasonLabel({ code: "future_signal", points: 5, detail: "" }, restaurant(), t)).toBe(
      t.explore.matchReasonGeneric,
    );
  });
});

describe("matchChipText", () => {
  it("собирает готовую строку «Итальянская · ₸₸» (сценарий 3.1 спеки)", () => {
    const reasons: TasteMatchReason[] = [
      { code: "cuisine_match", points: 400, params: { cuisine_codes: ["italian"] }, detail: "" },
      { code: "budget_match", points: 200, detail: "" },
    ];
    expect(matchChipText(reasons, restaurant({ priceLevel: "₸₸" }), t)).toBe("Итальянская · ₸₸");
  });

  it("пусто, когда показывать нечего", () => {
    expect(matchChipText(undefined, restaurant(), t)).toBe("");
    expect(matchChipText([{ code: "fallback_popular", points: 0, detail: "" }], restaurant(), t)).toBe("");
  });
});
