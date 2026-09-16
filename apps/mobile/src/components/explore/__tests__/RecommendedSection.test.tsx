import type { RestaurantPicks, RestaurantSummary } from "@bookeat/api";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ряд «Для вас» / «Выбрали для вас» (персонализация v1, критерии 20/21/23).
 *
 *   1. заголовок переключается ПОЛЕМ `data.mode` ответа, обе ветки — не
 *      знанием о профиле гостя (критерий 20 явно требует это разделить);
 *   2. чип причин на карточке следует тому же правилу, что в
 *      match-reason-label.test.ts, здесь — что он вообще появляется на
 *      экране при `mode === "for_you"` и отсутствует при фолбэке;
 *   3. `for_you_shown` уходит ровно ОДИН раз за монтирование, с реальными
 *      `mode`/`items_count`/`matched_count` из ответа (критерий 23, 🟡6.9).
 */

const query: {
  data?: RestaurantPicks;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: unknown;
  refetch: () => void;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  isSuccess: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock("../use-explore-data", () => ({
  useRecommendedRestaurants: () => query,
}));

vi.mock("../../../hooks/useFavorites", () => ({
  useRestaurantFavorite: () => ({ isFavorite: false, toggle: vi.fn() }),
}));

const trackEvent = vi.fn();
vi.mock("../../../lib/analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

const { RecommendedSection } = await import("../RecommendedSection");

function restaurant(overrides: Partial<RestaurantSummary> = {}): RestaurantSummary {
  return {
    id: "r1",
    name: "Пример",
    cuisines: [{ id: "italian", name: "Итальянская" }],
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

beforeEach(() => {
  query.data = undefined;
  query.isLoading = false;
  query.isError = false;
  query.isSuccess = false;
  trackEvent.mockReset();
});

describe("заголовок ряда по data.mode", () => {
  it('mode "for_you" — заголовок «Для вас»', () => {
    query.data = { items: [restaurant()], mode: "for_you" };
    query.isSuccess = true;

    render(<RecommendedSection onSeeAll={vi.fn()} onOpenRestaurant={vi.fn()} />);

    expect(screen.getByText("Для вас")).toBeTruthy();
    expect(screen.queryByText("Выбрали для вас")).toBeNull();
  });

  it.each(["editorial", "popular"] as const)('mode "%s" — прежний заголовок «Выбрали для вас»', (mode) => {
    query.data = { items: [restaurant()], mode };
    query.isSuccess = true;

    render(<RecommendedSection onSeeAll={vi.fn()} onOpenRestaurant={vi.fn()} />);

    expect(screen.getByText("Выбрали для вас")).toBeTruthy();
    expect(screen.queryByText("Для вас")).toBeNull();
  });

  it("пока ответа ещё нет — прежний заголовок, не «Для вас» на мгновение", () => {
    query.isLoading = true;

    render(<RecommendedSection onSeeAll={vi.fn()} onOpenRestaurant={vi.fn()} />);

    expect(screen.getByText("Выбрали для вас")).toBeTruthy();
  });
});

describe("чип причин на карточке", () => {
  it("mode for_you с match — чип виден", () => {
    query.data = {
      items: [
        {
          ...restaurant({
            cuisines: [
              { id: "italian", name: "Итальянская" },
              { id: "seafood", name: "Морепродукты" },
            ],
          }),
          match: {
            score: 400,
            reasons: [
              { code: "cuisine_match", points: 400, params: { cuisine_codes: ["seafood"] }, detail: "" },
            ],
          },
        },
      ],
      mode: "for_you",
    };
    query.isSuccess = true;

    render(<RecommendedSection onSeeAll={vi.fn()} onOpenRestaurant={vi.fn()} />);

    // Строка кухни («Итальянская, Морепродукты») отдельно от чипа причин
    // («Морепродукты» — конкретно совпавшая кухня, не весь набор заведения).
    expect(screen.getByText("Итальянская, Морепродукты")).toBeTruthy();
    expect(screen.getByText("Морепродукты")).toBeTruthy();
  });

  it("фолбэк без match — чипа нет", () => {
    query.data = { items: [restaurant()], mode: "popular" };
    query.isSuccess = true;

    render(<RecommendedSection onSeeAll={vi.fn()} onOpenRestaurant={vi.fn()} />);

    // Единственная строка под названием — кухня; чипа причин рядом нет.
    expect(screen.queryByText("Итальянская · ₸₸")).toBeNull();
  });
});

describe("for_you_shown", () => {
  it("уходит один раз при появлении ряда, с mode/items_count/matched_count из ответа", async () => {
    const matched = {
      ...restaurant({ id: "r2" }),
      match: { score: 400, reasons: [{ code: "cuisine_match", points: 400, detail: "" }] },
    };
    const unmatched = {
      ...restaurant({ id: "r3" }),
      match: { score: 0, reasons: [{ code: "fallback_popular", points: 0, detail: "" }] },
    };
    query.data = { items: [matched, unmatched], mode: "for_you" };
    query.isSuccess = true;

    const { rerender } = render(<RecommendedSection onSeeAll={vi.fn()} onOpenRestaurant={vi.fn()} />);

    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith("for_you_shown", {
        mode: "for_you",
        items_count: 2,
        matched_count: 1,
      }),
    );

    // Повторный рендер (например, обновление жестом с тем же ответом) не
    // должен слать событие второй раз за монтирование.
    rerender(<RecommendedSection onSeeAll={vi.fn()} onOpenRestaurant={vi.fn()} />);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});

describe("source, переданный при открытии карточки", () => {
  it('mode for_you — "for_you", иначе — "picks"', async () => {
    query.data = { items: [restaurant()], mode: "for_you" };
    query.isSuccess = true;
    const onOpenRestaurant = vi.fn();

    render(<RecommendedSection onSeeAll={vi.fn()} onOpenRestaurant={onOpenRestaurant} />);
    screen.getByText("Пример").closest("[role='button']")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    await waitFor(() => expect(onOpenRestaurant).toHaveBeenCalledWith("r1", "for_you"));
  });
});
