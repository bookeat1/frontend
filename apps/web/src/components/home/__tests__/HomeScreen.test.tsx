import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import type { RestaurantsPicksResult } from "@bookeat/api/client";

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
    repository.getRecommendedRestaurants = vi.fn(() => pending<RestaurantsPicksResult>());

    renderScreen(<HomeScreen />);

    expect((await screen.findAllByRole("status")).length).toBeGreaterThan(0);
  });

  it("пустые ленты объясняются словами, а не пустым местом", async () => {
    repository.getRecommendedRestaurants = vi.fn(async () => ({ items: [], mode: "popular" as const }));
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
    repository.getRecommendedRestaurants = vi.fn(async () => ({
      items: [venueSummary({ id: "xyz", name: "Chaihana Palau" })],
      mode: "popular" as const,
    }));

    renderScreen(<HomeScreen />);

    const link = await screen.findByRole("link", { name: "Chaihana Palau" });
    expect(link.getAttribute("href")).toBe("/venues/xyz");
  });

  /**
   * Заголовок ряда «Для вас»/«Выбрали для вас» — спека
   * `foodie-personalization-v1-20260916.md` §5.6/§26 (критерий 20 на
   * мобилке, тот же принцип на вебе): переключается по `data.mode` ответа,
   * не по локальному состоянию. Обе ветки.
   */
  describe("заголовок секции «Для вас»/«Выбрали для вас» — по mode ответа", () => {
    it("mode: for_you — заголовок «Для вас»", async () => {
      repository.getRecommendedRestaurants = vi.fn(async () => ({
        items: [venueSummary({ id: "xyz", name: "Chaihana Palau" })],
        mode: "for_you" as const,
      }));

      renderScreen(<HomeScreen />);

      expect(await screen.findByRole("heading", { name: "Для вас" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Выбрали для вас" })).toBeNull();
    });

    it("mode: popular — прежний заголовок «Выбрали для вас»", async () => {
      repository.getRecommendedRestaurants = vi.fn(async () => ({
        items: [venueSummary({ id: "xyz", name: "Chaihana Palau" })],
        mode: "popular" as const,
      }));

      renderScreen(<HomeScreen />);

      expect(await screen.findByRole("heading", { name: "Выбрали для вас" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Для вас" })).toBeNull();
    });

    it("mode: editorial — тоже прежний заголовок (ручной список — не персональный ряд)", async () => {
      repository.getRecommendedRestaurants = vi.fn(async () => ({
        items: [venueSummary({ id: "xyz", name: "Chaihana Palau" })],
        mode: "editorial" as const,
      }));

      renderScreen(<HomeScreen />);

      expect(await screen.findByRole("heading", { name: "Выбрали для вас" })).toBeTruthy();
    });
  });

  /**
   * Афиша на главной запрашивает `sort=for_you` (спека
   * `foodie-personalization-v1-20260916.md` §5.6/§19/§26); полный список
   * `/events` его не отправляет — проверено `useEventsFeed`
   * отдельно/неявно тем, что он вообще не читает `sort` из `EventQuery`
   * этого хука.
   */
  it("афиша на главной запрашивает /events с sort=for_you", async () => {
    renderScreen(<HomeScreen />);

    await screen.findByRole("heading", { name: "Афиша" });
    expect(repository.listUpcomingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "for_you" }),
    );
  });
  /**
   * Блок «Все заведения» на главной — узел `3525:14246` (`Catalog grid`,
   * `design-specs/web/spec-all-venues.md`, REST 2026-09-09): ОДИН ряд из
   * четырёх карточек, не два (правка владельца 2026-09-15 — старый тест
   * ожидал восемь, макет рисует только первый ряд и прячет остальное за
   * кнопкой), и кнопка на ОСТАТОК, а не ссылка «показать все» в шапке
   * секции. Число в кнопке настоящее — оно приходит из `total` выдачи, а не
   * нарисовано.
   */
  it("«Все заведения» показывает четыре карточки в один ряд и кнопку на остаток", async () => {
    repository.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: Array.from({ length: 20 }, (_, index) =>
        venueSummary({ id: `v${index}`, name: `Venue ${index}` }),
      ),
      total: 128,
    }));

    renderScreen(<HomeScreen />);

    expect(await screen.findByText("128 мест")).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Показать ещё 124 заведения" })).toBeTruthy();
    // Пятой карточки на главной быть не должно — она уводит на /venues.
    expect(screen.queryByRole("link", { name: "Venue 4" })).toBeNull();
    expect(screen.getByRole("link", { name: "Venue 3" })).toBeTruthy();
  });

  /** Показали всё — жать в кнопке не на что, и её нет. */
  it("когда заведений меньше четырёх, кнопки «Показать ещё» нет", async () => {
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
