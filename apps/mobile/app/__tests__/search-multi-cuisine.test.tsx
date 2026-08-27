import type { RestaurantRepository, SearchQuery } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchScreen from "../search";

/**
 * ФИЛЬТР ПО НЕСКОЛЬКИМ КУХНЯМ (переезд на справочник, 2026-08-25).
 *
 * Значение фильтра теперь — код справочника (`european`), а не casefold
 * русского текста, и сервер понимает список через запятую. Отсюда три вещи,
 * которые ломаются тихо и потому проверяются:
 *
 *   1. ссылка `/search?cuisine=greek,italian` открывает поиск с ДВУМЯ
 *      выбранными кухнями, а не с одной и не с мусорным чипом «greek,italian»;
 *   2. кухни снимаются по одной — сняли первую, вторая осталась и в выдаче, и
 *      чипом;
 *   3. параметр `focus` (им с главной раскрывают нужное колесо в шторке)
 *      продолжает работать РЯДОМ с кухнями: это разные параметры, и раньше
 *      кухня читалась из того же места.
 */

const t = getDictionary("ru");

const push = vi.fn();
let params: Record<string, string> = {};

// Шторка фильтров с 2026-08-27 содержит `TimeOfDayChips`, а он читает словарь
// из контекста (`useLocale`), которого в тесте экрана нет. Тот же приём, что в
// home-party-handoff.test.tsx.
vi.mock("../../src/lib/locale", async () => {
  const { getDictionary } = await import("@bookeat/i18n");
  return { useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }) };
});

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/search",
  useLocalSearchParams: () => params,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const searchRestaurants = vi.fn(async (_query: SearchQuery) => ({ items: [], total: 0 }));
/** Справочник в том виде, в каком его отдаёт `GET /cuisines`: код + название,
 * порядок задан платформой. */
const getCuisines = vi.fn(async () => [
  { id: "greek", name: "Греческая" },
  { id: "italian", name: "Итальянская" },
  { id: "kazakh", name: "Казахская" },
]);
const getCities = vi.fn(async () => [] as string[]);

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

function lastQuery(): SearchQuery {
  const calls = searchRestaurants.mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  params = {};
});

describe("несколько кухонь в фильтре", () => {
  it("ссылка с двумя кодами через запятую выбирает обе кухни", async () => {
    params = { cuisine: "greek,italian" };
    renderSearch();

    await waitFor(() =>
      expect(lastQuery().filters.cuisineIds).toEqual(["greek", "italian"]),
    );
    // И обе показаны чипами с человеческими названиями, а не одним «greek,italian».
    expect(
      await screen.findByRole("button", { name: t.a11y.removeFilter("Греческая") }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t.a11y.removeFilter("Итальянская") }),
    ).toBeTruthy();
  });

  it("пустые куски в параметре не превращаются в чип, который не снять", async () => {
    params = { cuisine: "greek,, ,italian" };
    renderSearch();

    await waitFor(() =>
      expect(lastQuery().filters.cuisineIds).toEqual(["greek", "italian"]),
    );
  });

  it("кухни снимаются ПО ОДНОЙ, остальные остаются", async () => {
    params = { cuisine: "greek,italian" };
    renderSearch();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: t.a11y.removeFilter("Греческая") }),
    );

    await waitFor(() => expect(lastQuery().filters.cuisineIds).toEqual(["italian"]));
    expect(
      screen.getByRole("button", { name: t.a11y.removeFilter("Итальянская") }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: t.a11y.removeFilter("Греческая") }),
    ).toBeNull();
  });

  it("в шторке кухня ДОБАВЛЯЕТСЯ к уже выбранной, а не заменяет её", async () => {
    params = { cuisine: "greek" };
    renderSearch();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: t.a11y.openFiltersWithCount(1) }),
    );
    const section = t.search.filters.cuisineTitle;
    await user.click(
      screen.getByRole("button", {
        name: `${section}: ${t.search.filters.summaryCount(1)}`,
      }),
    );
    // Кухни в шторке — чипы-кнопки (мультивыбор), а не чекбоксы.
    await user.click(screen.getByRole("button", { name: "Казахская" }));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    await waitFor(() =>
      expect(lastQuery().filters.cuisineIds).toEqual(["greek", "kazakh"]),
    );
  });

  it("кухни не теряются, когда в ссылке ещё и дата с гостями", async () => {
    params = { cuisine: "greek,italian", guests: "2", date: "2026-08-24" };
    renderSearch();

    await waitFor(() => {
      expect(lastQuery().filters.cuisineIds).toEqual(["greek", "italian"]);
      expect(lastQuery().filters.availability).toEqual({
        date: "2026-08-24",
        guests: 2,
      });
    });
    // Раньше этот же случай проверял ещё и параметр `focus`, раскрывавший
    // колесо гостей прямо при открытии каталога. Его больше нет (правка
    // владельца 2026-08-26): дату и гостей называют шторкой на главной, а
    // панель фильтров здесь остаётся закрытой — см.
    // `search-filter-panel-closed.test.tsx`.
    expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull();
  });
});
