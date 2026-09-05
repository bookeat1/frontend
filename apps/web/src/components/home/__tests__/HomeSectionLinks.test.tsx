import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import type { RestaurantSummary } from "@bookeat/api/client";

import { eventSummary, guideCollection, pending, renderScreen, repositoryStub } from "@web/test/harness";

/**
 * Ссылки «Вся афиша» / «Все подборки» и ссылка с карточки подборки живут за
 * флагом `SHOW_SECTION_LINKS` (роута `/guide` ещё нет; «Вся афиша» — за
 * отдельным `SHOW_EVENTS_LINK`, который включён). Проверяем
 * обе стороны флага: с включённым — ссылки есть и ведут куда надо, с
 * выключенным — их нет, но заголовки секций на месте.
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
  repository.getGuideCollections = vi.fn(async () => [guideCollection()]);
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
    expect(
      (await screen.findByRole("link", { name: "Зимние террасы" })).getAttribute("href"),
    ).toBe("/guide/winter-terraces");
  });

  it("при выключенном флаге ссылок нет, а секции и карточка на месте", async () => {
    stubSections();

    renderScreen(<HomeScreen />);

    expect(await screen.findByRole("heading", { name: "Зимние террасы" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Афиша" })).toBeTruthy();
    // «Вся афиша» живёт за своим флагом SHOW_EVENTS_LINK: роут /events есть.
    expect(screen.getByRole("link", { name: "Вся афиша" }).getAttribute("href")).toBe("/events");
    expect(screen.queryByRole("link", { name: "Все подборки" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Зимние террасы" })).toBeNull();
  });
});
