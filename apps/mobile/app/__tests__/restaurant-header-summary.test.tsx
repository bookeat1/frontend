import { __mockRestaurants, type Restaurant, type RestaurantRepository } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RestaurantDetailScreen from "../restaurant/[id]/index";

/**
 * ПОДПИСЬ ПОД ИМЕНЕМ МЕСТА в шапке экрана заведения.
 *
 * История: было «Открыто до 23:00» + чек + рейтинг; 2026-08-25 стало кухня +
 * чек + рейтинг отдельными чипами под фотографией; 2026-08-27 шапку заменил
 * «Hero / Editorial» (макет 3z0f6dgev4HMwBAHPjTjPo, node 3446:12620) — имя,
 * ОДНА строка «кухни · чек» и метка оценки лежат теперь НА снимке, и ряда
 * чипов с «+N» больше нет.
 *
 * Признак открытости всё это время остаётся ровно в одном месте — в блоке
 * расписания под описанием, где рядом с ним стоят и часы.
 *
 * Почему это проверяется тестом, а не глазами: «открытость исчезла с экрана
 * совсем» и «открытость переехала вниз» выглядят в диффе одинаково, а для
 * гостя это разные вещи. Поэтому блок расписания здесь ЗАГЛУШЕН маркером:
 * всё, что осталось от открытости выше по экрану, — это ошибка.
 */

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

/** Блок расписания под описанием — единственное место, где открытость теперь
 * живёт. Заглушен маркером, чтобы отличить «переехало» от «пропало». */
const SCHEDULE_MARKER = "БЛОК-РАСПИСАНИЯ";
vi.mock("../../src/components/VenueScheduleCard", () => ({
  VenueScheduleCard: () => <div>{SCHEDULE_MARKER}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: {} }),
}));

const getRestaurant = vi.fn<(id: string) => Promise<Restaurant>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getRestaurant }) as unknown as RestaurantRepository,
}));

function venue(over: Partial<Restaurant> = {}): Restaurant {
  return { ...__mockRestaurants[0], id: "r1", ...over };
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

describe("шапка экрана заведения", () => {
  it("не показывает открыто/закрыто — это ушло в блок расписания", async () => {
    getRestaurant.mockResolvedValue(venue());
    renderScreen();

    // Блок расписания на месте (значит информация не пропала)...
    expect(await screen.findByText(SCHEDULE_MARKER)).toBeTruthy();
    // ...а выше по экрану от открытости не осталось ничего.
    expect(screen.queryByText(/Открыт/)).toBeNull();
    expect(screen.queryByText(/Закрыт/)).toBeNull();
    expect(screen.queryByText(/Часы работы не указаны/)).toBeNull();
  });

  it("показывает кухню и ценовую ступень символами", async () => {
    getRestaurant.mockResolvedValue(
      venue({
        cuisines: [
          { id: "european", name: "Европейская" },
          { id: "kazakh", name: "Казахская" },
        ],
        priceLevel: "₸₸",
        priceRange: { min: 8000, max: 15000 },
      }),
    );
    renderScreen();

    // Кухни и чек — ОДНОЙ строкой через «·» (node 3446:12641), а не чипами.
    const subtitle = await screen.findByText(/Европейская/);
    expect(subtitle.textContent).toContain("Казахская");
    // Цена в этой строке — СТУПЕНЬЮ (правка владельца 2026-08-24); сумма в
    // тенге не рисуется, даже когда сервер прислал диапазон.
    expect(subtitle.textContent).toContain("₸₸");
    expect(subtitle.textContent).not.toMatch(/8\s?000/);
  });

  it("весь набор кухонь стоит в подписи, «+N» больше нет", async () => {
    // В новой шапке ширины хватает на всю строку, и прятать часть набора под
    // «+N» больше незачем: чипов, которые бы уехали за край, тут нет.
    getRestaurant.mockResolvedValue(
      venue({
        cuisines: [
          { id: "european", name: "Европейская" },
          { id: "kazakh", name: "Казахская" },
          { id: "georgian", name: "Грузинская" },
          { id: "italian", name: "Итальянская" },
        ],
      }),
    );
    renderScreen();

    const subtitle = await screen.findByText(/Европейская/);
    expect(subtitle.textContent).toContain("Грузинская");
    expect(screen.queryByText("+2")).toBeNull();
  });

  it("заведение без кухонь и без отзывов всё равно показывает ступень цены", async () => {
    // На бою такое есть: «Agora wine and deli» — кухонь нет; средний чек в
    // тенге не заполнен у большинства заведений каталога. Ступень есть всегда,
    // поэтому строка меток не пустеет.
    getRestaurant.mockResolvedValue(
      venue({
        name: "Agora wine and deli",
        cuisines: [],
        priceLevel: "₸₸",
        priceRange: undefined,
        reviewsCount: 0,
      }),
    );
    renderScreen();

    expect(await screen.findByText("Agora wine and deli")).toBeTruthy();
    expect(screen.getByText(/₸₸/)).toBeTruthy();
    // Ни чипа-заглушки кухни, ни прочерка вместо цены.
    expect(screen.queryByText("+0")).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
    // Экран при этом целый: блок расписания ниже отрисовался.
    expect(screen.getByText(SCHEDULE_MARKER)).toBeTruthy();
  });

  it("без числового диапазона от сервера цена всё равно ступенью", async () => {
    getRestaurant.mockResolvedValue(
      venue({
        cuisines: [{ id: "kazakh", name: "Казахская" }],
        priceLevel: "₸₸₸",
        priceRange: undefined,
      }),
    );
    renderScreen();

    // Подпись — одна строка «кухни · чек», поэтому ищем подстрокой.
    const subtitle = await screen.findByText(/Казахская/);
    expect(subtitle.textContent).toContain("₸₸₸");
  });
});
