import type { MenuDish, RestaurantSummary } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import type { UseQueryResult } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { atomicStyle } from "../../../../test/atomic-style";
import type { OceanSignatureDishesState } from "../use-ocean-signature-dishes";

const t = getDictionary("ru");

/**
 * ФИРМЕННАЯ СТРАНИЦА OCEAN BASKET целиком.
 *
 * Проверяется то, что решено осознанно и молча ломается:
 *
 *   1. Зашитое содержимое действительно на экране — главы истории,
 *      замыкающий блок, ник инстаграма.
 *   2. Шапка — по макету 2026-09-03: 327 плюс безопасная зона, плашка
 *      welcome drink на 255 от верха кадра.
 *   3. Плашка «WELCOME DRINK · Подробнее» — кнопка, по ней выезжает шторка
 *      с условиями, затемнение под ней чёрное 35 %, крестик её закрывает.
 *   4. Блюда «Фирменного улова» — из МЕНЮ, а не из словаря: название и цена
 *      с сервера, тап открывает карточку блюда без «Добавить».
 *   5. Сердечка в шапке нет: избранного для страниц бренда на бэкенде нет.
 *   6. Живая часть страницы живая: карточка точки открывает экран заведения.
 */

const push = vi.fn();
const back = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/brand/ocean-basket",
}));

const INSETS = { top: 44, bottom: 34, left: 0, right: 0 };

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => INSETS,
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Градиенты — это заливка, а не поведение: настоящий expo-linear-gradient
// тянет expo-modules-core, которого в jsdom нет (тот же случай, что у
// expo-image, см. test/stubs).
vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

function venue(id: string, name: string): RestaurantSummary {
  return {
    id,
    name,
    cuisines: [],
    priceLevel: "₸₸",
    rating: 0,
    reviewsCount: 0,
    address: "ул. Панфилова, 100",
    city: "Алматы",
    description: "",
    schedule: null,
    acceptsOnlineBookings: false,
  };
}

const VENUES = [venue("a", "Ocean Basket Panfilova"), venue("b", "Ocean Basket Dostyk Plaza")];

// Запрос точек подменяется его результатом: экран проверяется без сети, но
// сам список остаётся настоящим — карточки рисует боевой компонент.
vi.mock("../use-ocean-basket-venues", () => ({
  useOceanBasketVenues: (): UseQueryResult<RestaurantSummary[]> =>
    ({
      data: VENUES,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }) as unknown as UseQueryResult<RestaurantSummary[]>,
}));

/** Блюда — в том виде, в каком их отдаёт меню стенда (2026-09-03). Названия
 * НАРОЧНО не совпадают со старым словарём («King Креветки» без «6 шт»):
 * если экран нарисует словарную строку, а не серверную, тест это поймает. */
const PLATTER: MenuDish = {
  id: "dish-platter",
  name: "Full Deck Platter",
  description: "Большое плато морепродуктов",
  priceMinor: 3_799_000,
  imageUrl: null,
  isAvailable: true,
};
const PRAWNS: MenuDish = {
  id: "dish-prawns",
  name: "King Креветки 6 шт",
  description: "",
  priceMinor: 1_509_000,
  imageUrl: null,
  isAvailable: true,
};

const dishesState: OceanSignatureDishesState = { status: "ready", dishes: [PLATTER, PRAWNS] };

vi.mock("../use-ocean-signature-dishes", () => ({
  useOceanSignatureDishes: () => ({ state: dishesState, refetch: vi.fn() }),
}));

const { OceanBasketScreen } = await import("../OceanBasketScreen");

const byTestId = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("фирменная страница Ocean Basket", () => {
  it("рисует зашитое содержимое макета: главы истории, замыкающий блок, инстаграм", () => {
    render(<OceanBasketScreen />);

    expect(screen.getByText(t.oceanBasket.mapTitle)).toBeTruthy();
    expect(screen.getByText(t.oceanBasket.dishesTitle)).toBeTruthy();
    for (const chapter of t.oceanBasket.chapters) {
      expect(screen.getByText(chapter.title)).toBeTruthy();
    }
    expect(screen.getByText(t.oceanBasket.ctaTitle)).toBeTruthy();
    expect(screen.getByText("@oceanbasket.kz")).toBeTruthy();
  });

  it("шапка — 327 плюс безопасная зона, плашка welcome drink на 255 от верха кадра", () => {
    render(<OceanBasketScreen />);

    const hero = byTestId("ocean-hero");
    expect(hero).not.toBeNull();
    expect(atomicStyle(hero as HTMLElement)["height"]).toBe(`${INSETS.top + 327}px`);

    const plate = byTestId("ocean-hero-welcome");
    expect(plate).not.toBeNull();
    expect(atomicStyle(plate as HTMLElement)["top"]).toBe(`${INSETS.top + 255}px`);
  });

  it("блюда «Фирменного улова» — из меню: название и цена сервера, а не словаря", () => {
    render(<OceanBasketScreen />);

    expect(screen.getByText("King Креветки 6 шт")).toBeTruthy();
    expect(screen.getByText("Full Deck Platter")).toBeTruthy();
    // Цена печатается с НЕРАЗРЫВНЫМ пробелом («37\u00A0990\u00A0₸»), а
    // Testing Library схлопывает пробелы при обычном поиске — поэтому
    // сравнение идёт по textContent.
    expect(
      screen.getAllByText((_, element) => element?.textContent === "37\u00A0990\u00A0₸").length,
    ).toBeGreaterThan(0);
    // Строки-обещания про предзаказ нет.
    expect(screen.queryByText(/предзаказ/i)).toBeNull();
  });

  it("тап по блюду открывает карточку блюда без «Добавить»", () => {
    render(<OceanBasketScreen />);

    fireEvent.click(screen.getByLabelText(t.oceanBasket.dishOpen("Full Deck Platter")));

    const sheet = byTestId("dish-card-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toContain("Большое плато морепродуктов");
    expect(screen.queryByRole("button", { name: /^Добавить/ })).toBeNull();
  });

  it("плашка welcome drink — кнопка с «Подробнее», по ней выезжает шторка", () => {
    render(<OceanBasketScreen />);

    expect(byTestId("welcome-drink-sheet")).toBeNull();
    expect(screen.getByText(t.oceanBasket.welcomeDrinkAction)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: t.oceanBasket.welcomeDrinkA11y }));

    const sheet = byTestId("welcome-drink-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toContain(t.oceanBasket.welcomeSheet.includesTitle);
    expect(sheet?.textContent).toContain(t.oceanBasket.welcomeSheet.terms[3]);
  });

  it("затемнение под шторкой — чёрное 35 %, как измерено по макету", () => {
    render(<OceanBasketScreen />);
    fireEvent.click(screen.getByRole("button", { name: t.oceanBasket.welcomeDrinkA11y }));

    const backdrop = byTestId("welcome-drink-backdrop");
    expect(backdrop).not.toBeNull();
    expect(atomicStyle(backdrop as HTMLElement)["background-color"]).toBe("rgba(0,0,0,0.35)");
  });

  it("крестик закрывает шторку welcome drink", async () => {
    render(<OceanBasketScreen />);
    fireEvent.click(screen.getByRole("button", { name: t.oceanBasket.welcomeDrinkA11y }));
    expect(byTestId("welcome-drink-sheet")).not.toBeNull();

    const closeButtons = screen.getAllByRole("button", { name: t.a11y.closeButton });
    // Ровно один крестик — в шторке; на самой странице закрывать нечего.
    expect(closeButtons).toHaveLength(1);
    fireEvent.click(closeButtons[0]);

    // Не мгновенно: шторка доигрывает отъезд вниз и только потом снимается.
    await waitFor(() => {
      expect(byTestId("welcome-drink-sheet")).toBeNull();
    });
  });

  it("сердечка в шапке нет — избранного для страниц бренда не существует", () => {
    render(<OceanBasketScreen />);

    expect(document.querySelector('[data-testid="icon-Heart"]')).toBeNull();
  });

  it("карточка точки открывает экран заведения", () => {
    render(<OceanBasketScreen />);

    fireEvent.click(screen.getByLabelText(t.articles.openVenue("Ocean Basket Panfilova")));
    expect(push).toHaveBeenCalledWith("/restaurant/a");
  });
});
