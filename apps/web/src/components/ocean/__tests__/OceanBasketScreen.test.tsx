import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { MenuSection, RestaurantSummary, SearchResult } from "@bookeat/api/client";

import { pending, renderScreen, repositoryStub, venueSummary } from "@web/test/harness";

/**
 * Фирменная страница Ocean Basket на сайте (`/brand/ocean-basket`) —
 * четыре состояния списка точек и живой блок «Фирменный улов» из меню
 * первой точки, той же формулой, что у мобильного экрана.
 */

const stub = repositoryStub();
vi.mock("@web/lib/api", () => ({
  isApiConfigured: true,
  get repository() {
    return stub;
  },
  setApiLanguage: vi.fn(),
}));

function oceanVenue(overrides: Partial<RestaurantSummary> = {}): RestaurantSummary {
  return venueSummary({
    id: "ob-dostyk",
    name: "Ocean Basket Dostyk Plaza",
    city: "Алматы",
    ...overrides,
  });
}

function menuWithSignatureDishes(): MenuSection[] {
  return [
    {
      title: "Платтеры",
      dishes: [
        {
          id: "dish-1",
          name: "Full Deck Platter",
          description: "",
          priceMinor: 3799000,
          imageUrl: null,
          isAvailable: true,
        },
        {
          id: "dish-2",
          name: "King Креветки 6 шт",
          description: "",
          priceMinor: 1509000,
          imageUrl: null,
          isAvailable: true,
        },
      ],
    },
  ];
}

async function loadScreen() {
  const { OceanBasketScreen } = await import("@web/components/ocean/OceanBasketScreen");
  return renderScreen(<OceanBasketScreen />);
}

describe("фирменная страница Ocean Basket (веб)", () => {
  it("шапка, точки и живые блюда из меню первой точки", async () => {
    stub.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: [oceanVenue(), oceanVenue({ id: "ob-mega", name: "Ocean Basket Mega Alma-Ata" })],
      total: 2,
    }));
    stub.getMenuSections = vi.fn(async () => menuWithSignatureDishes());

    await loadScreen();

    expect(screen.getByRole("heading", { name: "Найдите свой улов" })).toBeTruthy();
    // Имя точки без повторения имени бренда.
    expect(await screen.findByText("Dostyk Plaza")).toBeTruthy();
    expect(screen.getByText("Mega Alma-Ata")).toBeTruthy();

    // Блюдо и цена приезжают из настоящего меню первой точки.
    expect(await screen.findByText("Full Deck Platter")).toBeTruthy();
    expect(screen.getByText("King Креветки 6 шт")).toBeTruthy();
    expect(vi.mocked(stub.getMenuSections)).toHaveBeenCalledWith("ob-dostyk");
  });

  it("чужое заведение из поиска (совпадение по меню) на странице не показывается", async () => {
    stub.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: [oceanVenue(), venueSummary({ id: "other", name: "Dastarkhan" })],
      total: 2,
    }));
    stub.getMenuSections = vi.fn(async () => []);

    await loadScreen();

    expect(await screen.findByText("Dostyk Plaza")).toBeTruthy();
    expect(screen.queryByText("Dastarkhan")).toBeNull();
  });

  it("точки не загрузились: сообщение и «Повторить», блюдо остаётся нейтральным", async () => {
    stub.searchRestaurants = vi.fn(async () => {
      throw new Error("boom");
    });

    await loadScreen();

    expect(await screen.findByText("Точки не загрузились")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
    // Без точки бренда меню спрашивать нечего — карточки блюда в ошибке, а не
    // в «нашлась пустая цена».
    expect(screen.getAllByText("Меню не загрузилось").length).toBeGreaterThan(0);
  });

  it("список точек ещё грузится: скелет", async () => {
    stub.searchRestaurants = vi.fn(() => pending<SearchResult>());
    await loadScreen();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("глав истории раскрыта ровно одна: клик по другой сворачивает первую", async () => {
    stub.searchRestaurants = vi.fn(async (query) => ({ query, items: [], total: 0 }));

    await loadScreen();

    // Первая глава открыта по умолчанию.
    const firstBody = await screen.findByText(/Маленькая лавка у океана/);
    expect(firstBody).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Раскрыть главу «Океан без границ»/ }));

    await waitFor(() => {
      expect(screen.queryByText(/Маленькая лавка у океана/)).toBeNull();
    });
    expect(screen.getByText(/От Йоханнесбурга до Дубая/)).toBeTruthy();
  });
});
