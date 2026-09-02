import type { RestaurantRepository, SearchQuery } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateChoices } from "../../src/lib/availability-label";
import { addDays, toDateKey } from "../../src/lib/format";
import SearchScreen from "../search";

/**
 * Подбор «дата + гости» над выдачей — ДВА чипа со стрелкой (макет 347:5942),
 * а не один общий чип с крестиком.
 *
 * Правило, которое здесь защищается, важнее внешнего вида: сервер отвечает на
 * вопрос «есть ли стол на N гостей в такой-то день» и половину запроса молча
 * игнорирует. Значит, чипов может быть два, а пара под ними обязана оставаться
 * целой:
 *   1. тап по чипу даты поднимает колесо ДАТЫ (не гостей) и ничего не снимает —
 *      чип гостей на месте, применённый подбор не изменился;
 *   2. выбор в колесе досылает вторую половину: уходит пара, а не одно поле;
 *   3. у чипов подбора НЕТ крестика — снять половину нечем, и ни один запрос за
 *      весь сценарий не уходит с датой без гостей или гостями без даты.
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
const getCuisines = vi.fn(async () => [{ id: "greek", name: "Греческая" }]);
const getAmenities = vi.fn(async () => [] as { id: string; name: string }[]);
const getCities = vi.fn(async () => [] as string[]);

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({ searchRestaurants, getCuisines, getAmenities, getCities }) as unknown as RestaurantRepository,
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

/**
 * Ни один запрос за сценарий не ушёл с половиной подбора. Проверяем ВСЕ вызовы,
 * а не последний: половина, мелькнувшая на один рендер, — это уже выдача,
 * которая не сузилась, при видимом чипе фильтра.
 */
function expectNoHalfPairEver() {
  for (const [query] of searchRestaurants.mock.calls) {
    const availability = query.filters.availability;
    if (availability === undefined) continue;
    expect(typeof availability.date).toBe("string");
    expect(availability.date).not.toBe("");
    expect(typeof availability.guests).toBe("number");
    expect(availability.guests).toBeGreaterThan(0);
  }
}

// «Сегодня» экран берёт с системных часов (`dateChoices(new Date())` в
// search.tsx), а ожидания ниже считались от СВОЕГО `new Date()` на загрузке
// модуля. Между ними секунды сбора файла, и если в них попадает полночь Алматы
// (19:00 UTC, `TZ` в vitest.setup.ts), чип подписан уже от другого дня — тест
// краснеет раз в сутки без всякой правки. Момент прибит: и ожидание, и экран
// считают от одного FIXED_NOW.
const FIXED_NOW = new Date("2026-09-01T12:00:00+05:00");
const today = FIXED_NOW;
const inThreeDays = toDateKey(addDays(today, 3));
const tomorrowKey = toDateKey(addDays(today, 1));
const labelFor = dateChoices(today).labelFor;

/** Чип-половина подбора: подписан своим разделом, как и капсула в шторке. */
const dateChip = () =>
  screen.getByRole("button", {
    name: `${t.booking.dateSectionTitle}: ${labelFor(inThreeDays)}`,
  });
const guestsChip = (guests: number) =>
  screen.getByRole("button", {
    name: `${t.booking.guestsSectionTitle}: ${t.booking.guestsCount(guests)}`,
  });

// beforeEach, а не beforeAll: общий vitest.setup.ts делает vi.useRealTimers()
// в afterEach, и подмена на весь файл дожила бы только до конца первого теста.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FIXED_NOW);
  params = { guests: "3", date: inThreeDays };
  searchRestaurants.mockClear();
  push.mockClear();
});

describe("чипы подбора «дата + гости» над выдачей", () => {
  it("подбор показан двумя чипами, а не одним общим", async () => {
    renderSearch();

    await waitFor(() =>
      expect(lastQuery().filters.availability).toEqual({ date: inThreeDays, guests: 3 }),
    );
    expect(dateChip()).toBeTruthy();
    expect(guestsChip(3)).toBeTruthy();
    // Слитой подписи «сегодня · 2 гостя» больше нет.
    expect(
      screen.queryByText(`${labelFor(inThreeDays)} · ${t.booking.guestsCount(3)}`),
    ).toBeNull();
  });

  it("тап по чипу даты открывает колесо ДАТЫ и не трогает гостей", async () => {
    renderSearch();
    const user = userEvent.setup();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    const before = searchRestaurants.mock.calls.length;

    await user.click(dateChip());

    // Колесо именно дат, а не гостей и не панель фильтров целиком.
    expect(await screen.findByText(t.booking.pickDateTitle)).toBeTruthy();
    expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull();
    expect(screen.queryByText(t.search.filters.title)).toBeNull();
    // Открытие ничего не сняло: чип гостей на месте, нового запроса не было.
    expect(guestsChip(3)).toBeTruthy();
    expect(lastQuery().filters.availability).toEqual({ date: inThreeDays, guests: 3 });
    expect(searchRestaurants.mock.calls.length).toBe(before);
    expectNoHalfPairEver();
  });

  it("выбор в колесе даты досылает гостей — уходит пара", async () => {
    renderSearch();
    const user = userEvent.setup();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    await user.click(dateChip());
    await screen.findByText(t.booking.pickDateTitle);
    await user.click(screen.getByRole("button", { name: t.booking.tomorrow }));
    await user.click(screen.getByRole("button", { name: t.search.availabilityDone }));

    await waitFor(() =>
      expect(lastQuery().filters.availability).toEqual({ date: tomorrowKey, guests: 3 }),
    );
    // Оба чипа переехали на новое значение, ни один не исчез.
    expect(
      screen.getByRole("button", {
        name: `${t.booking.dateSectionTitle}: ${t.booking.tomorrow}`,
      }),
    ).toBeTruthy();
    expect(guestsChip(3)).toBeTruthy();
    expectNoHalfPairEver();
  });

  it("тап по чипу гостей открывает колесо ГОСТЕЙ и сохраняет дату", async () => {
    renderSearch();
    const user = userEvent.setup();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    await user.click(guestsChip(3));

    expect(await screen.findByText(t.booking.pickGuestsTitle)).toBeTruthy();
    expect(screen.queryByText(t.booking.pickDateTitle)).toBeNull();
    expect(dateChip()).toBeTruthy();

    await user.click(screen.getByRole("button", { name: t.booking.guestsCount(6) }));
    await user.click(screen.getByRole("button", { name: t.search.availabilityDone }));

    await waitFor(() =>
      expect(lastQuery().filters.availability).toEqual({ date: inThreeDays, guests: 6 }),
    );
    expect(dateChip()).toBeTruthy();
    expectNoHalfPairEver();
  });

  it("половину подбора снять нечем: крестика у этих чипов нет", async () => {
    renderSearch();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    // Крестики в ряду есть только у снимаемых фильтров — у подбора их нет.
    expect(
      screen.queryByRole("button", {
        name: t.a11y.removeFilter(labelFor(inThreeDays)),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: t.a11y.removeFilter(t.booking.guestsCount(3)),
      }),
    ).toBeNull();
    expect(screen.queryAllByRole("button", { name: /Убрать фильтр/ })).toHaveLength(0);
    expectNoHalfPairEver();
  });

  it("подбор снимается ЦЕЛИКОМ — крестиком капсулы в шторке фильтров", async () => {
    renderSearch();
    const user = userEvent.setup();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    // Подбор выбран, значит кнопка называется «Открыть фильтры, выбрано: 1».
    await user.click(await screen.findByRole("button", { name: /^Открыть фильтры/ }));
    await user.click(await screen.findByRole("button", { name: t.search.availabilityReset }));
    await user.click(screen.getByRole("button", { name: t.search.filters.apply }));

    await waitFor(() => expect(lastQuery().filters.availability).toBeUndefined());
    // Ушли ОБА чипа: половины друг без друга не остаётся.
    expect(
      screen.queryByRole("button", {
        name: `${t.booking.dateSectionTitle}: ${labelFor(inThreeDays)}`,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: `${t.booking.guestsSectionTitle}: ${t.booking.guestsCount(3)}`,
      }),
    ).toBeNull();
    expectNoHalfPairEver();
  });
});
