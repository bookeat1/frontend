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
  /**
   * Блок «Все заведения» на главной — узлы 3255:26…3255:220. Из макета: восемь
   * карточек (две строки по четыре) и кнопка на ОСТАТОК, а не ссылка «показать
   * все» в шапке секции. Число в кнопке настоящее — оно приходит из `total`
   * выдачи, а не нарисовано.
   */
  it("«Все заведения» показывает восемь карточек и кнопку на остаток", async () => {
    repository.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: Array.from({ length: 20 }, (_, index) =>
        venueSummary({ id: `v${index}`, name: `Venue ${index}` }),
      ),
      total: 128,
    }));

    renderScreen(<HomeScreen />);

    expect(await screen.findByText("128 мест")).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Показать ещё 120 заведений" })).toBeTruthy();
    // Девятой карточки на главной быть не должно — она уводит на /venues.
    expect(screen.queryByRole("link", { name: "Venue 8" })).toBeNull();
    expect(screen.getByRole("link", { name: "Venue 7" })).toBeTruthy();
  });

  /** Показали всё — жать в кнопке не на что, и её нет. */
  it("когда заведений меньше восьми, кнопки «Показать ещё» нет", async () => {
    repository.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: [venueSummary({ id: "only", name: "Lou Lou" })],
      total: 1,
    }));

    renderScreen(<HomeScreen />);

    expect(await screen.findByRole("link", { name: "Lou Lou" })).toBeTruthy();
    expect(screen.queryByText(/Показать ещё/)).toBeNull();
  });

  /**
   * Секция «Приложение» (узел 3256:66) — ДВЕ кнопки магазинов. Google Play
   * долго не рисовался, потому что адрес искали по неверному имени пакета;
   * ссылка ниже — та, что реально отвечает 200 (`kz.bookeat.app`), и она же
   * стоит в `apps/mobile/app.config.js`.
   */
  it("в секции приложения обе кнопки магазинов и обе с настоящими адресами", async () => {
    renderScreen(<HomeScreen />);

    const appStore = await screen.findByRole("link", { name: "Скачать в App Store" });
    const googlePlay = await screen.findByRole("link", { name: "Скачать в Google Play" });

    expect(appStore.getAttribute("href")).toContain("apps.apple.com");
    expect(googlePlay.getAttribute("href")).toBe(
      "https://play.google.com/store/apps/details?id=kz.bookeat.app",
    );
  });
});
