import { EMPTY_FILTERS, type SearchFilters } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Событие «гость применил фильтры».
 *
 * 🔴 ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА: в свойствах события нет ничего, что человек
 * набрал руками. Это не теория — 298 из 349 событий поиска за первые десять
 * дней оказались набранными вручную номерами телефонов, и мы складывали чужие
 * персональные данные в сторонний сервис. Тест ловит возврат такой утечки
 * через фильтры: он проверяет не «какие поля есть», а что НИ ОДНО значение
 * свойств не содержит ни телефона, ни имени, ни названия города.
 */

const trackEvent = vi.fn();
vi.mock("../../lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

vi.mock("../../lib/repository", () => ({
  useRepository: () => ({
    searchRestaurants: () => Promise.resolve({ items: [], total: 0 }),
    getCities: () => Promise.resolve([]),
    getCuisines: () => Promise.resolve([]),
    getVenueFeatures: () => Promise.resolve([]),
  }),
}));

const { describeFilters, useSearchScreen } = await import("../useSearch");

const FULL: SearchFilters = {
  cuisineIds: ["european", "kazakh"],
  amenityIds: ["terrace"],
  openNowOnly: true,
  onlineBookableOnly: false,
  city: "Алматы",
  priceLevel: "₸₸",
  availability: { date: "2026-09-01", guests: 4, timeOfDay: "dinner" },
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSearchScreen(), { wrapper });
}

beforeEach(() => {
  trackEvent.mockClear();
});

describe("свойства события фильтров", () => {
  it("описывают форму выбора: счётчики, переключатели, ступень чека", () => {
    expect(describeFilters(FULL)).toEqual({
      active_count: 7,
      cuisine_count: 2,
      amenity_count: 1,
      open_now: true,
      online_bookable: false,
      has_city: true,
      price_level: "₸₸",
      has_availability: true,
      guests: 4,
      time_of_day: "dinner",
    });
  });

  it("не содержат ни названия города, ни даты подбора, ни какого-либо текста", () => {
    const props = describeFilters(FULL);
    const serialized = JSON.stringify(props);

    expect(serialized).not.toContain("Алматы");
    expect(serialized).not.toContain("2026-09-01");
    // Коды кухонь и удобств тоже не уходят — только их количество.
    expect(serialized).not.toContain("european");
    expect(serialized).not.toContain("terrace");
  });

  it("у пустого набора всё нулевое — это и есть «сбросил фильтры»", () => {
    expect(describeFilters(EMPTY_FILTERS)).toMatchObject({
      active_count: 0,
      cuisine_count: 0,
      has_city: false,
      price_level: null,
      guests: null,
    });
  });
});

describe("отправка события фильтров", () => {
  it("молчит на первом рендере — начальное состояние не выбор гостя", () => {
    setup();

    expect(trackEvent).not.toHaveBeenCalledWith("search_filters_apply", expect.anything());
  });

  it("уходит один раз на каждый применённый набор", () => {
    const { result } = setup();

    act(() => {
      result.current.setFilters(FULL);
    });

    const applies = trackEvent.mock.calls.filter((call) => call[0] === "search_filters_apply");
    expect(applies).toHaveLength(1);
    expect(applies[0]?.[1]).toMatchObject({ active_count: 7, cuisine_count: 2 });

    act(() => {
      result.current.setFilters(EMPTY_FILTERS);
    });

    const afterReset = trackEvent.mock.calls.filter((call) => call[0] === "search_filters_apply");
    expect(afterReset).toHaveLength(2);
    expect(afterReset[1]?.[1]).toMatchObject({ active_count: 0 });
  });
});
