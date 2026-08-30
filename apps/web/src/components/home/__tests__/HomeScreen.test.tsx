import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import type { RestaurantSummary } from "@bookeat/api/client";

import { pending, renderScreen, repositoryStub, venueSummary } from "@web/test/harness";

/**
 * Главная — это восемь независимых блоков. Проверяем не вёрстку, а что каждый
 * из них ЧЕСТЕН: пока данные едут — видно загрузку, пустой ответ объяснён
 * словами, а упавшая секция не уносит с собой остальную страницу.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { HomeScreen } = await import("@web/components/home/HomeScreen");

describe("главная", () => {
  it("пока подборка едет, на её месте загрузка", async () => {
    repository.getRecommendedRestaurants = vi.fn(() => pending<RestaurantSummary[]>());

    renderScreen(<HomeScreen />);

    expect((await screen.findAllByRole("status")).length).toBeGreaterThan(0);
  });

  it("пустые ленты объясняются словами, а не пустым местом", async () => {
    repository.getRecommendedRestaurants = vi.fn(async () => []);
    repository.getPromotions = vi.fn(async () => []);

    renderScreen(<HomeScreen />);

    expect(await screen.findByText("Для этого города подборку ещё не собрали.")).toBeTruthy();
    expect(await screen.findByText("Сейчас в этом городе акций нет.")).toBeTruthy();
  });

  it("упавшая лента показывает ошибку и НЕ ломает соседнюю", async () => {
    repository.getRecommendedRestaurants = vi.fn(async () => {
      throw new Error("network down");
    });
    repository.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: [venueSummary({ id: "abc", name: "Auyl" })],
      total: 1,
    }));

    renderScreen(<HomeScreen />);

    expect((await screen.findAllByText("Не удалось загрузить")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: "Auyl" })).toBeTruthy();
  });

  it("карточка заведения ведёт на его страницу", async () => {
    repository.getRecommendedRestaurants = vi.fn(async () => [
      venueSummary({ id: "xyz", name: "Chaihana Palau" }),
    ]);

    renderScreen(<HomeScreen />);

    const link = await screen.findByRole("link", { name: "Chaihana Palau" });
    expect(link.getAttribute("href")).toBe("/venues/xyz");
  });
});
