import type { MenuDish, MenuSection, Restaurant, RestaurantRepository } from "@bookeat/api";
import { __mockRestaurants } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * СМЕНА ЗАПРОСА ВОЗВРАЩАЕТ СПИСОК В НАЧАЛО.
 *
 * Баг, пойманный на ревью PR #102: сбрасывались только индексы разделов, а сам
 * `SectionList` при смене `sections` НЕ пересоздаётся — положение прокрутки
 * остаётся прежним и лишь зажимается по новой высоте содержимого. У «Абая» с
 * ~200 блюдами гость, долиставший до «Десертов», после ввода одной буквы
 * видел хвост выдачи, хотя чип категории уже подсвечивал первый раздел.
 *
 * Проверяем ровно то, чего в jsdom не сделать иначе: что экран ПРОСИТ
 * нижележащий скролл встать в 0 и просит без анимации. Настоящую прокрутку
 * (инерцию, зажим по высоте) меряет платформа — это остаётся проверкой на
 * устройстве.
 */

const t = getDictionary("ru");

/** Записанные вызовы `scrollTo` нижележащего ScrollView. */
const scrollCalls: { x?: number; y?: number; animated?: boolean }[] = [];

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");
  const React2 = await import("react");

  /**
   * Подменяем ТОЛЬКО SectionList и ровно в двух вещах: он отдаёт наружу
   * `getScrollResponder()` с записывающим `scrollTo` и рисует строки, чтобы
   * отбор по-прежнему был виден в дереве. Всё остальное — настоящее.
   */
  const SectionListStub = React2.forwardRef(function SectionListStub(
    props: {
      sections: { title: string; data: MenuDish[] }[];
      renderItem: (info: { item: MenuDish }) => React.ReactNode;
      renderSectionHeader?: (info: { section: { title: string } }) => React.ReactNode;
    },
    ref: React.Ref<unknown>,
  ) {
    React2.useImperativeHandle(ref, () => ({
      getScrollResponder: () => ({
        scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => {
          scrollCalls.push(options);
        },
      }),
      scrollToLocation: () => undefined,
    }));

    return (
      <actual.View>
        {props.sections.map((section) => (
          <actual.View key={section.title}>
            {props.renderSectionHeader?.({ section })}
            {section.data.map((item) => (
              <React2.Fragment key={item.id}>{props.renderItem({ item })}</React2.Fragment>
            ))}
          </actual.View>
        ))}
      </actual.View>
    );
  });

  return { ...actual, SectionList: SectionListStub };
});

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

const RestaurantMenuScreen = (await import("../restaurant/[id]/menu")).default;

function dish(id: string, name: string, description = ""): MenuDish {
  return { id, name, description, priceMinor: 500_000, imageUrl: null, isAvailable: true };
}

const MENU: MenuSection[] = [
  { title: "Мангал", dishes: [dish("1", "Стейк Рибай"), dish("2", "Люля-кебаб")] },
  { title: "Десерты", dishes: [dish("3", "Пахлава")] },
];

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RestaurantMenuScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  scrollCalls.length = 0;
  getMenuSections.mockReset();
  getRestaurant.mockReset();
  getMenuSections.mockResolvedValue(MENU);
  getRestaurant.mockResolvedValue({ ...__mockRestaurants[0], id: "r1" });
});

describe("смена запроса возвращает меню в начало", () => {
  it("ввод буквы просит список встать в 0 и без анимации", async () => {
    renderScreen();
    expect(await screen.findByText("Стейк Рибай")).toBeTruthy();
    expect(scrollCalls).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(t.restaurant.menuSearchPlaceholder), {
      target: { value: "пахлава" },
    });

    expect(scrollCalls).toEqual([{ y: 0, animated: false }]);
  });

  it("очистка запроса возвращает в начало точно так же", async () => {
    renderScreen();
    expect(await screen.findByText("Стейк Рибай")).toBeTruthy();

    const field = screen.getByLabelText(t.restaurant.menuSearchPlaceholder);
    fireEvent.change(field, { target: { value: "пахлава" } });
    fireEvent.change(field, { target: { value: "" } });

    expect(scrollCalls).toEqual([
      { y: 0, animated: false },
      { y: 0, animated: false },
    ]);
  });
});
