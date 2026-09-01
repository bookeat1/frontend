import type { RestaurantSummary } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import type { UseQueryResult } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const t = getDictionary("ru");

/**
 * ФИРМЕННАЯ СТРАНИЦА OCEAN BASKET целиком.
 *
 * Проверяется то, что решено осознанно и молча ломается:
 *
 *   1. Зашитое содержимое действительно на экране — блюда с ценами, главы
 *      истории, замыкающий блок. Это единственная защита текста, который
 *      больше неоткуда взять: у бэкенда таких полей нет.
 *   2. Блюдо НЕ КНОПКА и строки про предзаказ нет. Строка из макета обещает
 *      оформление заказа, которого приложение сделать не может: у зашитого
 *      блюда нет `menu_item_id`.
 *   3. Первая глава истории раскрыта (так нарисовано), а главы без текста —
 *      не кнопки: стрелка, открывающая пустоту, хуже её отсутствия.
 *   4. Сердечка в шапке нет: избранного для страниц бренда на бэкенде нет.
 *   5. Живая часть страницы живая: карточка точки открывает экран заведения.
 */

const push = vi.fn();
const back = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/brand/ocean-basket",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
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

const { OceanBasketScreen } = await import("../OceanBasketScreen");

describe("фирменная страница Ocean Basket", () => {
  it("рисует зашитое содержимое макета: блюда, главы истории, замыкающий блок", () => {
    render(<OceanBasketScreen />);

    expect(screen.getByText(t.oceanBasket.mapTitle)).toBeTruthy();
    expect(screen.getByText(t.oceanBasket.dishesTitle)).toBeTruthy();
    for (const dish of t.oceanBasket.dishes) {
      expect(screen.getByText(dish.name)).toBeTruthy();
      // Цена печатается с НЕРАЗРЫВНЫМ пробелом («37\u00A0990 ₸»), а
      // Testing Library схлопывает пробелы при обычном поиске — поэтому
      // сравнение идёт по textContent (то же правило действует у денег в
      // остальных тестах).
      expect(
        screen.getAllByText((_, element) => element?.textContent === dish.price).length,
      ).toBeGreaterThan(0);
    }
    for (const chapter of t.oceanBasket.chapters) {
      expect(screen.getByText(chapter.title)).toBeTruthy();
    }
    expect(screen.getByText(t.oceanBasket.ctaTitle)).toBeTruthy();
    expect(screen.getByText(t.oceanBasket.instagramHandle)).toBeTruthy();
  });

  it("блюдо не нажимается и предзаказ не обещан", () => {
    render(<OceanBasketScreen />);

    const dish = screen.getByText(t.oceanBasket.dishes[0].name);
    // Ни само название, ни его карточка не объявлены кнопкой.
    expect(dish.closest('[role="button"]')).toBeNull();
    expect(screen.queryByText(/предзаказ/i)).toBeNull();
  });

  it("первая глава раскрыта, а глава без текста — не кнопка", () => {
    render(<OceanBasketScreen />);

    const [first, second] = t.oceanBasket.chapters;
    // Текст первой главы виден сразу — так нарисовано в макете.
    expect(screen.getByText(first.body)).toBeTruthy();
    // У неё есть кнопка сворачивания…
    expect(screen.getByLabelText(t.oceanBasket.chapterCollapse(first.title))).toBeTruthy();
    // …а у главы без текста нет ни кнопки раскрытия, ни кнопки сворачивания.
    expect(screen.queryByLabelText(t.oceanBasket.chapterExpand(second.title))).toBeNull();
    expect(screen.queryByLabelText(t.oceanBasket.chapterCollapse(second.title))).toBeNull();
  });

  it("первая глава сворачивается нажатием и текст уходит", () => {
    render(<OceanBasketScreen />);

    const [first] = t.oceanBasket.chapters;
    fireEvent.click(screen.getByLabelText(t.oceanBasket.chapterCollapse(first.title)));

    expect(screen.queryByText(first.body)).toBeNull();
    expect(screen.getByLabelText(t.oceanBasket.chapterExpand(first.title))).toBeTruthy();
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
