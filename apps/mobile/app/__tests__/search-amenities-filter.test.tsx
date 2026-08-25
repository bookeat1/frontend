import type { RestaurantRepository, RestaurantSummary, SearchQuery } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchScreen from "../search";

/**
 * Фильтр «Удобства» на экране поиска.
 *
 * До 2026-08-25 он был декорацией: список был зашит в код семью кодами, а
 * выбор жил в `UiOnlyFacets` и в запрос не уходил вовсе — гость отмечал
 * «Намазхана», жал «Применить» и получал ту же выдачу. Здесь закреплено то,
 * что делает его настоящим:
 *   1. галочки строятся ИЗ СПРАВОЧНИКА сервера (`GET /venue-features`), а не
 *      из константы: в справочнике девятнадцать записей, в константе было
 *      семь, и подписи расходились с кабинетом;
 *   2. выбранное уходит в `filters.amenityIds`, то есть в запрос;
 *   3. два удобства уходят вместе — сервер трактует их как И;
 *   4. чип над выдачей снимает удобство по одному и сразу переспрашивает;
 *   5. счётчик на кнопке фильтров и «Сбросить» удобства учитывают;
 *   6. удобство, которого нет ни у одного заведения, даёт ПУСТУЮ ВЫДАЧУ со
 *      ссылкой «Сбросить фильтры», а не пустой экран без объяснения.
 */

const t = getDictionary("ru");

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/search",
  useLocalSearchParams: () => ({}),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

/** Заведения мока: у кого какие удобства. «Халал» нет ни у кого — ровно как
 * на бою, где шесть записей справочника пока пустые. */
const VENUES: { venue: RestaurantSummary; features: string[] }[] = [
  { venue: summary("v1", "Aiza Esentai"), features: ["terrace", "wifi"] },
  { venue: summary("v2", "Koktobe Terrace"), features: ["terrace"] },
  { venue: summary("v3", "Social Coffee"), features: ["wifi"] },
];

function summary(id: string, name: string): RestaurantSummary {
  return {
    id,
    name,
    cuisines: [],
    priceLevel: "₸₸",
    rating: 4.5,
    reviewsCount: 10,
    address: "Алматы",
    description: "",
    photos: [],
    schedule: null,
    acceptsOnlineBookings: true,
  } as unknown as RestaurantSummary;
}

/** Мок сервера: фильтрует по И, как настоящий `?features=`. */
const searchRestaurants = vi.fn(async (query: SearchQuery) => {
  const wanted = query.filters.amenityIds;
  const items = VENUES.filter((v) => wanted.every((code) => v.features.includes(code))).map(
    (v) => v.venue,
  );
  return { query, items, total: items.length };
});

const getCuisines = vi.fn(async () => [{ id: "greek", name: "Греческая" }]);
const getCities = vi.fn(async () => [] as string[]);
const getAmenities = vi.fn(async () => [
  { id: "terrace", name: "Терраса" },
  { id: "wifi", name: "Wi-Fi" },
  // Ноль заведений — и всё равно в списке: решение владельца, данные он
  // заполняет сам.
  { id: "halal", name: "Халал" },
]);

// Сердечко избранного на карточке заведения ходит в сессию, а этот тест про
// фильтр: подменяем ровно хук карточки, чтобы не поднимать AuthProvider.
vi.mock("../../src/hooks/useFavorites", () => ({
  useRestaurantFavorite: () => ({ isFavorite: false, toggle: () => {}, failed: false }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({
      searchRestaurants,
      getCuisines,
      getAmenities,
      getCities,
    }) as unknown as RestaurantRepository,
}));

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

/** Открывает шторку и разворачивает раздел «Удобства». */
async function openAmenities(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: t.a11y.openFilters }));
  await user.click(
    await screen.findByRole("button", {
      name: `${t.search.filters.amenitiesTitle}: ${t.search.filters.summaryNone}`,
    }),
  );
}

beforeEach(() => {
  searchRestaurants.mockClear();
  getAmenities.mockClear();
});

describe("список удобств приходит с сервера", () => {
  it("галочки — записи справочника, включая те, у которых нет ни одного заведения", async () => {
    const user = userEvent.setup();
    renderSearch();
    await openAmenities(user);

    expect(screen.getByRole("checkbox", { name: "Терраса" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Wi-Fi" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Халал" })).toBeTruthy();
    expect(getAmenities).toHaveBeenCalled();
  });

  it("удобства, которого в справочнике нет, в шторке тоже нет", async () => {
    // «Намазхана» была в зашитом списке AMENITY_IDS. Теперь список только
    // серверный — придумывать галочки приложению нечем.
    const user = userEvent.setup();
    renderSearch();
    await openAmenities(user);

    expect(screen.queryByRole("checkbox", { name: "Намазхана" })).toBeNull();
  });

  it("справочник не ответил — предложение повторить, а не пустой список галочек", async () => {
    getAmenities.mockRejectedValueOnce(new Error("сеть"));
    const user = userEvent.setup();
    renderSearch();
    await openAmenities(user);

    expect(await screen.findByText(t.search.filterAmenitiesFailed)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Терраса" })).toBeNull();
  });
});

describe("выбор удобства сужает выдачу", () => {
  it("отмеченное удобство уходит в запрос после «Применить»", async () => {
    const user = userEvent.setup();
    renderSearch();
    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual([]));

    await openAmenities(user);
    await user.click(screen.getByRole("checkbox", { name: "Терраса" }));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual(["terrace"]));
    // И выдача действительно сузилась — заведения без террасы в ней нет.
    expect(await screen.findByText("Koktobe Terrace")).toBeTruthy();
    expect(screen.queryByText("Social Coffee")).toBeNull();
  });

  it("два удобства работают как И: остаётся только заведение с обоими", async () => {
    const user = userEvent.setup();
    renderSearch();

    await openAmenities(user);
    await user.click(screen.getByRole("checkbox", { name: "Терраса" }));
    await user.click(screen.getByRole("checkbox", { name: "Wi-Fi" }));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual(["terrace", "wifi"]));
    expect(await screen.findByText("Aiza Esentai")).toBeTruthy();
    expect(screen.queryByText("Koktobe Terrace")).toBeNull();
    expect(screen.queryByText("Social Coffee")).toBeNull();
  });

  it("счётчик на кнопке фильтров считает удобства", async () => {
    const user = userEvent.setup();
    renderSearch();

    await openAmenities(user);
    await user.click(screen.getByRole("checkbox", { name: "Терраса" }));
    await user.click(screen.getByRole("checkbox", { name: "Wi-Fi" }));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    expect(
      await screen.findByRole("button", { name: t.a11y.openFiltersWithCount(2) }),
    ).toBeTruthy();
  });

  it("чип над выдачей снимает удобство ПО ОДНОМУ и сразу переспрашивает сервер", async () => {
    const user = userEvent.setup();
    renderSearch();

    await openAmenities(user);
    await user.click(screen.getByRole("checkbox", { name: "Терраса" }));
    await user.click(screen.getByRole("checkbox", { name: "Wi-Fi" }));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));
    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual(["terrace", "wifi"]));

    await user.click(
      await screen.findByRole("button", { name: t.a11y.removeFilter("Терраса") }),
    );

    // Шторку для этого открывать не пришлось, второе удобство осталось.
    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual(["wifi"]));
    expect(screen.queryByText(t.search.filters.title)).toBeNull();
    expect(await screen.findByRole("button", { name: t.a11y.removeFilter("Wi-Fi") })).toBeTruthy();
  });

  it("«Сбросить» в шторке убирает удобства из запроса", async () => {
    const user = userEvent.setup();
    renderSearch();

    await openAmenities(user);
    await user.click(screen.getByRole("checkbox", { name: "Терраса" }));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));
    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual(["terrace"]));

    await user.click(await screen.findByRole("button", { name: t.a11y.openFiltersWithCount(1) }));
    const resets = screen.getAllByRole("button", { name: t.search.filters.reset });
    await user.click(resets[resets.length - 1]);
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual([]));
    expect(screen.queryByRole("button", { name: t.a11y.removeFilter("Терраса") })).toBeNull();
  });
});

describe("удобство, которого нет ни у одного заведения", () => {
  it("даёт понятное пустое состояние со ссылкой сбросить фильтры", async () => {
    const user = userEvent.setup();
    renderSearch();

    await openAmenities(user);
    await user.click(screen.getByRole("checkbox", { name: "Халал" }));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual(["halal"]));
    // Не «каталог пуст» и не ошибка — «ничего не нашлось» ПО ЭТОМУ фильтру,
    // названному в описании, и предложение его снять.
    expect(await screen.findByText(t.search.emptyTitle)).toBeTruthy();
    expect(screen.getByText(t.search.emptyFilterDescription("Халал"))).toBeTruthy();
    const reset = screen.getByRole("button", { name: t.search.emptyResetFilters });

    await user.click(reset);

    await waitFor(() => expect(lastQuery().filters.amenityIds).toEqual([]));
    expect(await screen.findByText("Aiza Esentai")).toBeTruthy();
  });
});

describe("«Повод» после переезда удобств остался прежним", () => {
  it("выбирается и показывается чипом, но в запрос НЕ уходит", async () => {
    // Серверного поля под повод нет вовсе, поэтому он остался в UiOnlyFacets.
    // Проверка здесь ради того, чтобы переезд удобств его не задел: чип
    // рисуется, запрос — тот же самый.
    const user = userEvent.setup();
    renderSearch();
    await user.click(await screen.findByRole("button", { name: t.a11y.openFilters }));
    await user.click(screen.getByText(t.search.filters.occasion.date));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    expect(
      await screen.findByRole("button", {
        name: t.a11y.removeFilter(t.search.filters.occasion.date),
      }),
    ).toBeTruthy();
    // Ни одного поля запроса повод не трогает — выдача осталась полной.
    expect(lastQuery().filters).toEqual({
      cuisineIds: [],
      amenityIds: [],
      openNowOnly: false,
      onlineBookableOnly: false,
    });
    expect(await screen.findByText("Social Coffee")).toBeTruthy();
  });
});
