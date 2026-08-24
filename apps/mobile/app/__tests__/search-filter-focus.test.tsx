import type { RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchScreen from "../search";

/**
 * Переход «главная → поиск» с уже раскрытым нужным фильтром.
 *
 * На главной дата и гости — две РАЗНЫЕ половины капсулы, и человек, нажавший
 * «2 гостя», назвал компанию, а не «хочу в каталог». Раньше оба тапа вели в
 * `/search` одинаково, и выбор гостей ждал его за кнопкой-ползунками, внутри
 * шторки фильтров, — то есть его просили сказать то же самое второй раз.
 *
 * Проверяем ровно это и границы вокруг:
 *   1. `focus=guests` открывает колесо ГОСТЕЙ, `focus=date` — колесо ДАТЫ;
 *   2. без параметра ничего не раскрывается (обычный каталог);
 *   3. мусор в параметре — это «не раскрывать», а не пустой экран;
 *   4. раскрытие ОДНОРАЗОВОЕ: закрыл шторку, открыл её сам кнопкой фильтров —
 *      видит список фильтров, а не снова колесо.
 */

const t = getDictionary("ru");

const push = vi.fn();
let params: Record<string, string> = {};

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/search",
  useLocalSearchParams: () => params,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const searchRestaurants = vi.fn(async () => ({ items: [], total: 0 }));
const getCuisines = vi.fn(async () => []);
const getCities = vi.fn(async () => []);

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({ searchRestaurants, getCuisines, getCities }) as unknown as RestaurantRepository,
}));

function renderSearch() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SearchScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  params = {};
});

describe("какой фильтр раскрыт при переходе с главной", () => {
  it("focus=guests раскрывает выбор числа гостей", async () => {
    params = { guests: "2", date: "2026-08-24", focus: "guests" };
    renderSearch();

    expect(await screen.findByText(t.booking.pickGuestsTitle)).toBeTruthy();
    expect(screen.queryByText(t.booking.pickDateTitle)).toBeNull();
  });

  it("focus=date раскрывает выбор даты", async () => {
    params = { guests: "2", date: "2026-08-24", focus: "date" };
    renderSearch();

    expect(await screen.findByText(t.booking.pickDateTitle)).toBeTruthy();
    expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull();
  });

  it("без параметра открывается обычный каталог — ни шторки, ни колеса", async () => {
    params = {};
    renderSearch();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    expect(screen.queryByText(t.search.filters.title)).toBeNull();
    expect(screen.queryByText(t.booking.pickDateTitle)).toBeNull();
    expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull();
  });

  it("непонятное значение параметра ничего не раскрывает и не ломает экран", async () => {
    params = { focus: "нечто" };
    renderSearch();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    expect(screen.queryByText(t.search.filters.title)).toBeNull();
    expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull();
  });

  it("раскрытие одноразовое: следующее открытие шторки — обычные фильтры", async () => {
    params = { guests: "2", date: "2026-08-24", focus: "guests" };
    renderSearch();
    const user = userEvent.setup();

    // Закрываем сначала колесо, потом всю шторку.
    expect(await screen.findByText(t.booking.pickGuestsTitle)).toBeTruthy();
    // Крестик колеса и крестик шторки подписаны одинаково («Закрыть»);
    // колесо лежит ВНУТРИ шторки, поэтому его крестик — последний в разметке.
    const closers = screen.getAllByRole("button", { name: t.search.availabilityClose });
    await user.click(closers[closers.length - 1]);
    await waitFor(() => expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull());
    await user.click(screen.getByRole("button", { name: t.common.close }));
    await waitFor(() => expect(screen.queryByText(t.search.filters.title)).toBeNull());

    // Открываем шторку сами — теперь это список фильтров, а не колесо.
    await user.click(screen.getByRole("button", { name: t.a11y.openFilters }));
    expect(await screen.findByText(t.search.filters.title)).toBeTruthy();
    expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull();
  });
});
