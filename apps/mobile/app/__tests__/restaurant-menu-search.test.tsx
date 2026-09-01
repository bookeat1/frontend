import type { MenuDish, MenuSection, Restaurant, RestaurantRepository } from "@bookeat/api";
import { __mockRestaurants } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RestaurantMenuScreen from "../restaurant/[id]/menu";

/**
 * Поиск по меню — макет 49Zk9oEV3ZCiCdh6Cz9dE2, node 918:11948 (поле
 * 3563:7051, подпись 3563:7055 «Название блюда или ингредиента»).
 *
 * Проверяется поведение, а не пиксели: поле есть, отбор идёт и по названию, и
 * по описанию, пустая выдача НЕ выглядит как пустое меню и НЕ уносит с собой
 * само поле, а очистка возвращает меню целиком.
 */

const t = getDictionary("ru");

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/restaurant/r1/menu",
  useLocalSearchParams: () => ({ id: "r1" }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: {} }),
}));

const getMenuSections = vi.fn<(id: string) => Promise<MenuSection[]>>();
const getRestaurant = vi.fn<(id: string) => Promise<Restaurant>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getMenuSections, getRestaurant }) as unknown as RestaurantRepository,
}));

function dish(id: string, name: string, description = ""): MenuDish {
  return { id, name, description, priceMinor: 500_000, imageUrl: null, isAvailable: true };
}

const MENU: MenuSection[] = [
  {
    title: "Мангал",
    dishes: [
      dish("1", "Стейк Рибай", "Говядина, овощи гриль, фирменный соус"),
      dish("2", "Люля-кебаб", "Баранина, лук, специи"),
    ],
  },
  { title: "Десерты", dishes: [dish("3", "Пахлава", "Мёд, грецкий орех")] },
];

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RestaurantMenuScreen />
    </QueryClientProvider>,
  );
}

/** Поле адресуется так же, как его видит скринридер, — по своей подписи. */
function searchField() {
  return screen.getByLabelText(t.restaurant.menuSearchPlaceholder);
}

beforeEach(() => {
  getMenuSections.mockReset();
  getRestaurant.mockReset();
  getMenuSections.mockResolvedValue(MENU);
  getRestaurant.mockResolvedValue({ ...__mockRestaurants[0], id: "r1" });
});

describe("поиск по меню", () => {
  it("поле стоит над списком и подписано как в макете", async () => {
    renderScreen();
    expect(await screen.findByText("Стейк Рибай")).toBeTruthy();
    expect(searchField()).toBeTruthy();
  });

  it("отбирает по названию блюда и убирает раздел, в котором ничего не осталось", async () => {
    renderScreen();
    expect(await screen.findByText("Стейк Рибай")).toBeTruthy();

    fireEvent.change(searchField(), { target: { value: "пахлава" } });

    expect(screen.getByText("Пахлава")).toBeTruthy();
    expect(screen.queryByText("Стейк Рибай")).toBeNull();
    // Заголовок раздела без единого блюда под ним читается как потеря данных.
    expect(screen.queryByText("Мангал")).toBeNull();
  });

  it("отбирает по ингредиенту из описания — так подписано поле", async () => {
    renderScreen();
    expect(await screen.findByText("Стейк Рибай")).toBeTruthy();

    fireEvent.change(searchField(), { target: { value: "баранина" } });

    expect(screen.getByText("Люля-кебаб")).toBeTruthy();
    expect(screen.queryByText("Стейк Рибай")).toBeNull();
  });

  it("ничего не нашли — своя подпись, а НЕ «ресторан ещё не добавил меню»", async () => {
    renderScreen();
    expect(await screen.findByText("Стейк Рибай")).toBeTruthy();

    fireEvent.change(searchField(), { target: { value: "суши" } });

    expect(screen.getByText(t.restaurant.menuSearchEmptyTitle)).toBeTruthy();
    expect(screen.queryByText(t.restaurant.menuEmpty)).toBeNull();
    // Поле остаётся на экране: иначе исправить опечатку нечем.
    expect(searchField()).toBeTruthy();
  });

  it("очистка запроса возвращает меню целиком", async () => {
    renderScreen();
    expect(await screen.findByText("Стейк Рибай")).toBeTruthy();

    fireEvent.change(searchField(), { target: { value: "суши" } });
    expect(screen.queryByText("Стейк Рибай")).toBeNull();

    fireEvent.change(searchField(), { target: { value: "" } });
    expect(screen.getByText("Стейк Рибай")).toBeTruthy();
    expect(screen.getByText("Пахлава")).toBeTruthy();
  });

  it("у заведения без меню поля поиска нет — искать нечего", async () => {
    getMenuSections.mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByText(t.restaurant.menuEmpty)).toBeTruthy();
    expect(screen.queryByLabelText(t.restaurant.menuSearchPlaceholder)).toBeNull();
  });
});
