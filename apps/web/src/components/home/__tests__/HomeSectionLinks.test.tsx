import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import type { RestaurantSummary } from "@bookeat/api/client";

import { eventSummary, guideCollection, pending, renderScreen, repositoryStub } from "@web/test/harness";

/**
 * Ссылка «Все подборки» в шапке секции живёт за флагом `SHOW_SECTION_LINKS`
 * (роута `/guide` листинга это не касается — он есть, но ссылка на него в
 * шапке всё ещё под флагом; «Вся афиша» — за отдельным `SHOW_EVENTS_LINK`,
 * который включён). Проверяем обе стороны флага: с включённым — ссылка есть
 * и ведёт куда надо, с выключенным — её нет, но заголовки секций на месте.
 *
 * Ссылка С КАРТОЧКИ подборки (2026-09-09, решение владельца) от этого флага
 * больше НЕ зависит — она есть, когда у подборки есть `categorySlugs`,
 * независимо от `SHOW_SECTION_LINKS` (см. `guideCardHref` в `Cards.tsx`).
 */

const flags = vi.hoisted(() => ({ showSectionLinks: false }));

vi.mock("@web/components/home/Cards", async (importOriginal) => {
  const original = await importOriginal<typeof import("@web/components/home/Cards")>();
  return {
    ...original,
    get SHOW_SECTION_LINKS() {
      return flags.showSectionLinks;
    },
  };
});

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

function stubSections() {
  repository.getRecommendedRestaurants = vi.fn(() => pending<RestaurantSummary[]>());
  repository.listUpcomingEvents = vi.fn(async () => ({
    items: [eventSummary()],
    total: 1,
    page: 1,
    pages: 1,
    perPage: 3,
  }));
  repository.getGuideCollections = vi.fn(async () => [
    guideCollection({ categorySlugs: ["winter-terraces-rubric"] }),
  ]);
}

afterEach(() => {
  flags.showSectionLinks = false;
});

describe("ссылки секций главной", () => {
  it("при включённом флаге «Вся афиша», «Все подборки» и карточка подборки — ссылки", async () => {
    flags.showSectionLinks = true;
    stubSections();

    renderScreen(<HomeScreen />);

    expect((await screen.findByRole("link", { name: "Вся афиша" })).getAttribute("href")).toBe(
      "/events",
    );
    expect(screen.getByRole("link", { name: "Все подборки" }).getAttribute("href")).toBe("/guide");
    // Карточка подборки — ссылка есть независимо от флага (см. тест ниже),
    // но при включённом флаге она, разумеется, тоже на месте.
    expect(
      (await screen.findByRole("link", { name: "Зимние террасы" })).getAttribute("href"),
    ).toBe("/guide/rubric/winter-terraces-rubric");
  });

  it("при выключенном флаге «Всей афиши»/«Всех подборок» нет, но карточка подборки с categorySlugs всё равно ссылка", async () => {
    stubSections();

    renderScreen(<HomeScreen />);

    expect(await screen.findByRole("heading", { name: "Афиша" })).toBeTruthy();
    // «Вся афиша» живёт за своим флагом SHOW_EVENTS_LINK: роут /events есть.
    expect(screen.getByRole("link", { name: "Вся афиша" }).getAttribute("href")).toBe("/events");
    expect(screen.queryByRole("link", { name: "Все подборки" })).toBeNull();
    // Карточка подборки больше не зависит от SHOW_SECTION_LINKS (2026-09-09):
    // у неё есть categorySlugs — значит есть и адрес, флаг ни при чём.
    expect(
      (await screen.findByRole("link", { name: "Зимние террасы" })).getAttribute("href"),
    ).toBe("/guide/rubric/winter-terraces-rubric");
  });

  it("при выключенном флаге и без categorySlugs у карточки подборки ссылки нет", async () => {
    repository.getRecommendedRestaurants = vi.fn(() => pending<RestaurantSummary[]>());
    repository.listUpcomingEvents = vi.fn(async () => ({
      items: [eventSummary()],
      total: 1,
      page: 1,
      pages: 1,
      perPage: 3,
    }));
    repository.getGuideCollections = vi.fn(async () => [guideCollection({ categorySlugs: [] })]);

    renderScreen(<HomeScreen />);

    expect(await screen.findByRole("heading", { name: "Зимние террасы" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Зимние террасы" })).toBeNull();
  });

  /** Ocean Basket — исключение из `SHOW_SECTION_LINKS`: у него уже есть своя
   * страница `/brand/ocean-basket`, поэтому карточка на главной кликабельна
   * даже при выключенном флаге (2026-09-09, п.1 постмёрдж-фиксов). */
  it("карточка Ocean Basket кликабельна даже при выключенном флаге", async () => {
    repository.getRecommendedRestaurants = vi.fn(() => pending<RestaurantSummary[]>());
    repository.listUpcomingEvents = vi.fn(async () => ({
      items: [eventSummary()],
      total: 1,
      page: 1,
      pages: 1,
      perPage: 3,
    }));
    repository.getGuideCollections = vi.fn(async () => [
      guideCollection({ slug: "ocean-basket", title: "Ocean Basket" }),
    ]);

    renderScreen(<HomeScreen />);

    expect((await screen.findByRole("link", { name: "Ocean Basket" })).getAttribute("href")).toBe(
      "/brand/ocean-basket",
    );
  });
});
