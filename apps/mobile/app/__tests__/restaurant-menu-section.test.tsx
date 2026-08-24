import { __mockRestaurants, type Restaurant, type RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RestaurantDetailScreen from "../restaurant/[id]/index";

/**
 * Блок «Популярное в меню» на карточке заведения.
 *
 * Признака «меню нет» бэкенд не присылает: `GET /restaurants/:id/menu` отдаёт
 * либо позиции, либо пустой массив, а при отказе ответ вовсе не доезжает
 * (запрос необязательный) — во всех трёх случаях `menuHighlights` пуст.
 * Поэтому прячем по ФАКТУ отсутствия позиций, а не по флагу, которого нет.
 *
 * Раньше у заведения без меню на экране оставались заголовок, строка «Ресторан
 * ещё не добавил меню» и кнопка «Посмотреть меню», ведущая на такой же пустой
 * экран (он читает ту же ручку).
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

// Обе ленты ходят за своими данными и к этой проверке отношения не имеют.
vi.mock("../../src/components/restaurant/StoriesRail", () => ({ StoriesRail: () => null }));
vi.mock("../../src/components/booking/MapPreview", () => ({ MapPreview: () => null }));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: {} }),
}));

const getRestaurant = vi.fn<(id: string) => Promise<Restaurant>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getRestaurant }) as unknown as RestaurantRepository,
}));

/** Настоящее заведение из фикстур, у которого меню либо есть, либо нет. */
function venue(menuHighlights: Restaurant["menuHighlights"]): Restaurant {
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

describe("«Популярное в меню» у заведения без меню", () => {
  it("блока нет целиком: ни заголовка, ни кнопки «Посмотреть меню»", async () => {
    getRestaurant.mockResolvedValue(venue([]));
    renderScreen();

    // Экран дождался данных — иначе проверка «ничего нет» проходит на пустом
    // состоянии загрузки и не значит ничего.
    expect(await screen.findByText(t.restaurant.about)).toBeTruthy();

    expect(screen.queryByText(t.restaurant.menuHighlights)).toBeNull();
    expect(screen.queryByText(t.restaurant.menuEmpty)).toBeNull();
    expect(screen.queryByRole("button", { name: t.restaurant.viewMenu })).toBeNull();
  });

  it("с позициями блок на месте — заголовок, блюдо и кнопка", async () => {
    const withMenu = venue(__mockRestaurants[0].menuHighlights);
    expect(withMenu.menuHighlights.length).toBeGreaterThan(0);
    getRestaurant.mockResolvedValue(withMenu);
    renderScreen();

    expect(await screen.findByText(t.restaurant.menuHighlights)).toBeTruthy();
    expect(screen.getByText(withMenu.menuHighlights[0].name)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.restaurant.viewMenu })).toBeTruthy();
  });
});
