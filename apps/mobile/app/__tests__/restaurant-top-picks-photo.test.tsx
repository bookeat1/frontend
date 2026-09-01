import { __mockRestaurants, type MenuHighlight, type Restaurant, type RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RestaurantDetailScreen from "../restaurant/[id]/index";

/**
 * «Лучшие позиции» на карточке заведения показывают ТОЛЬКО блюда с фотографией.
 *
 * Баг владельца (2026-09-01): в ленте живого заведения стояли две серые плашки
 * — «Айран 1 л» и «Айран 200 мл». Карточка ленты это в первую очередь снимок
 * (180×120, node 918:11701), и ряд плашек читается как поломка витрины.
 *
 * Три границы, которые тест держит:
 *   1. блюдо без фото из ленты выпадает, блюдо с фото остаётся;
 *   2. фото нет НИ У КОГО — заголовка и ленты нет вовсе (пустой заголовок
 *      хуже отсутствия блока);
 *   3. кнопка «Посмотреть меню» при этом ОСТАЁТСЯ: меню у заведения есть, и
 *      спрятать вход в него значило бы вернуть уже чинёный баг «меню
 *      недостижимо».
 */

const t = getDictionary("ru");

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/restaurant/r1",
  useLocalSearchParams: () => ({ id: "r1" }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/components/restaurant/StoriesRail", () => ({ StoriesRail: () => null }));
vi.mock("../../src/components/booking/MapPreview", () => ({ MapPreview: () => null }));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: {} }),
}));

const getRestaurant = vi.fn<(id: string) => Promise<Restaurant>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getRestaurant }) as unknown as RestaurantRepository,
}));

/** Цена печатается с неразрывным пробелом — в тестах только escape-последовательностью. */
const AIRAN: MenuHighlight = {
  id: "airan-1",
  name: "Айран 1 л",
  description: "",
  price: "1 200 ₸",
  priceMinor: 120_000,
  isTopPick: false,
  photo: undefined,
};

const AIRAN_SMALL: MenuHighlight = { ...AIRAN, id: "airan-2", name: "Айран 200 мл" };

const RIBEYE: MenuHighlight = {
  id: "ribeye",
  name: "Стейк Рибай",
  description: "Говядина, овощи гриль",
  price: "8 990 ₸",
  priceMinor: 899_000,
  isTopPick: true,
  photo: {
    id: "ribeye-photo",
    uri: "https://cdn.example/ribeye.jpg",
    width: 1200,
    height: 800,
    alt: "Стейк Рибай",
    category: "food",
  },
};

function venue(menuHighlights: MenuHighlight[]): Restaurant {
  return { ...__mockRestaurants[0], id: "r1", menuHighlights };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RestaurantDetailScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getRestaurant.mockReset();
});

describe("«Лучшие позиции» и блюда без фотографии", () => {
  it("блюдо без фото в ленту не попадает, блюдо с фото остаётся", async () => {
    getRestaurant.mockResolvedValue(venue([RIBEYE, AIRAN, AIRAN_SMALL]));
    renderScreen();

    expect(await screen.findByText(t.restaurant.menuHighlights)).toBeTruthy();
    expect(screen.getByText(RIBEYE.name)).toBeTruthy();
    expect(screen.queryByText(AIRAN.name)).toBeNull();
    expect(screen.queryByText(AIRAN_SMALL.name)).toBeNull();
  });

  it("фото нет ни у одного блюда — заголовка и ленты нет совсем", async () => {
    getRestaurant.mockResolvedValue(venue([AIRAN, AIRAN_SMALL]));
    renderScreen();

    // Дожидаемся загруженного экрана, иначе «ничего нет» проверяется на
    // состоянии загрузки и не значит ничего.
    expect(await screen.findByText(t.restaurant.about)).toBeTruthy();
    expect(screen.queryByText(t.restaurant.menuHighlights)).toBeNull();
    expect(screen.queryByText(AIRAN.name)).toBeNull();
  });

  it("но «Посмотреть меню» остаётся — меню у заведения есть", async () => {
    getRestaurant.mockResolvedValue(venue([AIRAN, AIRAN_SMALL]));
    renderScreen();

    expect(await screen.findByText(t.restaurant.about)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.restaurant.viewMenu })).toBeTruthy();
  });

  it("позиций нет вовсе — нет и кнопки: экран меню открылся бы пустым", async () => {
    getRestaurant.mockResolvedValue(venue([]));
    renderScreen();

    expect(await screen.findByText(t.restaurant.about)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.restaurant.viewMenu })).toBeNull();
  });
});
