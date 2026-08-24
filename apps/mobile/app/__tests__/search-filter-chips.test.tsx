import type { RestaurantRepository, SearchQuery } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchScreen from "../search";

/**
 * Ряд чипов применённых фильтров над выдачей и чипы выбранного у свёрнутых
 * разделов шторки.
 *
 * Что здесь защищается:
 *   1. нет фильтров — НЕТ и строки: пустая полоса над результатами читается
 *      как «что-то выбрано, но не показано»;
 *   2. крестик снимает ровно свой фильтр и переспрашивает сервер СРАЗУ, без
 *      открытия шторки — иначе чип показывает состояние, которого в выдаче
 *      уже (или ещё) нет;
 *   3. у крестика есть метка, называющая фильтр («Убрать фильтр Греческая»):
 *      подряд идущие чипы иначе озвучиваются одинаково;
 *   4. свёрнутый раздел шторки показывает выбранное чипами, а не красной
 *      подписью «1 выбрано», и снять выбор можно не разворачивая раздел.
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

const searchRestaurants = vi.fn(async (_query: SearchQuery) => ({ items: [], total: 0 }));
const getCuisines = vi.fn(async () => [
  { id: "greek", name: "Греческая" },
  { id: "italian", name: "Итальянская" },
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

/** Последний запрос, ушедший в репозиторий. */
function lastQuery(): SearchQuery {
  const calls = searchRestaurants.mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  params = {};
});

describe("ряд чипов применённых фильтров", () => {
  it("без фильтров строки чипов нет вовсе", async () => {
    renderSearch();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    // Ни одного крестика «убрать фильтр» — значит, и ряда над выдачей нет.
    expect(screen.queryAllByRole("button", { name: /Убрать фильтр/ })).toHaveLength(0);
    expect(screen.queryByText("Греческая")).toBeNull();
  });

  it("кухня из параметра показана чипом с подписанным крестиком", async () => {
    params = { cuisine: "greek" };
    renderSearch();

    expect(
      await screen.findByRole("button", { name: t.a11y.removeFilter("Греческая") }),
    ).toBeTruthy();
  });

  it("крестик снимает свой фильтр и сразу переспрашивает сервер", async () => {
    params = { cuisine: "greek" };
    renderSearch();
    const user = userEvent.setup();

    const remove = await screen.findByRole("button", {
      name: t.a11y.removeFilter("Греческая"),
    });
    await waitFor(() => expect(lastQuery().filters.cuisineIds).toEqual(["greek"]));

    await user.click(remove);

    // Новый поиск ушёл сам, шторку для этого открывать не пришлось.
    await waitFor(() => expect(lastQuery().filters.cuisineIds).toEqual([]));
    expect(screen.queryByText(t.search.filters.title)).toBeNull();
    // И чип исчез вместе с фильтром.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: t.a11y.removeFilter("Греческая") }),
      ).toBeNull(),
    );
  });

  it("дата и гости — один чип, снимается парой", async () => {
    params = { guests: "3", date: "2026-12-31" };
    renderSearch();
    const user = userEvent.setup();

    const label = t.search.filterAvailability("31 декабря", t.booking.guestsCount(3));
    const remove = await screen.findByRole("button", { name: t.a11y.removeFilter(label) });
    await waitFor(() =>
      expect(lastQuery().filters.availability).toEqual({ date: "2026-12-31", guests: 3 }),
    );

    await user.click(remove);

    await waitFor(() => expect(lastQuery().filters.availability).toBeUndefined());
  });
});

describe("свёрнутый раздел шторки показывает выбранное чипами", () => {
  it("выбранное удобство видно чипом и снимается без разворачивания раздела", async () => {
    renderSearch();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: t.a11y.openFilters }));
    // Разворачиваем «Удобства», отмечаем «Терраса», сворачиваем обратно.
    const amenities = t.search.filters.amenitiesTitle;
    await user.click(
      screen.getByRole("button", { name: `${amenities}: ${t.search.filters.summaryNone}` }),
    );
    await user.click(screen.getByRole("checkbox", { name: t.search.filters.amenities.terrace }));
    await user.click(
      screen.getByRole("button", {
        name: `${amenities}: ${t.search.filters.summaryCount(1)}`,
      }),
    );

    // Вместо красной подписи «1 выбрано» — чип с названием и крестиком.
    expect(screen.queryByText(t.search.filters.summaryCount(1))).toBeNull();
    const remove = screen.getByRole("button", {
      name: t.a11y.removeFilter(t.search.filters.amenities.terrace),
    });

    await user.click(remove);

    // Чип ушёл, раздел снова «Не выбрано» — и всё это со свёрнутым разделом.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: t.a11y.removeFilter(t.search.filters.amenities.terrace),
        }),
      ).toBeNull(),
    );
    // «Не выбрано» вернулось в заголовок раздела (оно же есть у «Кухни»,
    // поэтому спрашиваем именно заголовок «Удобств», а не текст на экране).
    expect(
      screen.getByRole("button", { name: `${amenities}: ${t.search.filters.summaryNone}` }),
    ).toBeTruthy();
  });

  it("«Сбросить фильтры» в шторке очищает и чипы выбранного", async () => {
    params = { cuisine: "greek" };
    renderSearch();
    const user = userEvent.setup();

    // Кухня уже выбрана — кнопка фильтров подписана со счётчиком.
    await user.click(
      await screen.findByRole("button", { name: t.a11y.openFiltersWithCount(1) }),
    );
    // В шторке кухня показана чипом у свёрнутого раздела «Кухня».
    const inSheet = await screen.findAllByRole("button", {
      name: t.a11y.removeFilter("Греческая"),
    });
    // Один чип в ряду над выдачей, второй — в шторке.
    expect(inSheet.length).toBe(2);

    // «Сбросить фильтры» подписаны одинаково у кнопки шторки и у ссылки в
    // пустой выдаче; шторка лежит в разметке последней.
    const resets = screen.getAllByRole("button", { name: t.search.filters.reset });
    await user.click(resets[resets.length - 1]);
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    await waitFor(() => expect(lastQuery().filters.cuisineIds).toEqual([]));
    expect(screen.queryByRole("button", { name: t.a11y.removeFilter("Греческая") })).toBeNull();
  });
});
