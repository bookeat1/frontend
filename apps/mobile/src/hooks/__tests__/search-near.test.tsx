import { EMPTY_FILTERS } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «Поиск» с геопозицией (спека geolocation-permission.md, критерии 9, 14, 28):
 * координаты идут в запрос только при пустом тексте, не влияют на фильтры, а
 * `catalog_distance_sort_applied` уходит раз за визит и без координат.
 */

vi.mock("../../lib/geo/location-native", () => ({
  hasLocationModule: () => false,
  importLocation: () => Promise.reject(new Error("not used")),
}));

const trackEvent = vi.fn();
vi.mock("../../lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

const searchRestaurants = vi.fn((_query: unknown) => Promise.resolve({ items: [], total: 0 }));
vi.mock("../../lib/repository", () => ({
  useRepository: () => ({
    searchRestaurants,
    getCities: () => Promise.resolve([]),
    getCuisines: () => Promise.resolve([]),
    getVenueFeatures: () => Promise.resolve([]),
  }),
}));

const { locationWrapper, makeLocation } = await import("../../lib/geo/__tests__/fake-location");
const { countActiveFilters, describeFilters, useSearchScreen } = await import("../useSearch");

const RAW = { lat: 43.238123, lng: 76.945678 };

function setup(loc = makeLocation({ permission: "granted", peekFresh: vi.fn(() => RAW) })) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const geo = locationWrapper({ current: loc });
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const Geo = geo;
    return (
      <QueryClientProvider client={queryClient}>
        <Geo>{children}</Geo>
      </QueryClientProvider>
    );
  };
  return renderHook(() => useSearchScreen(), { wrapper });
}

beforeEach(() => {
  searchRestaurants.mockClear();
  trackEvent.mockClear();
});

describe("near в запросе поиска", () => {
  it("пустой текст + позиция: запрос с округлённым near и подпись «по расстоянию»", async () => {
    const { result } = setup();
    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    expect(searchRestaurants.mock.calls[0]?.[0]).toEqual({
      text: "",
      filters: EMPTY_FILTERS,
      near: { lat: 43.238, lng: 76.946 },
    });
    expect(result.current.sortedByDistance).toBe(true);
  });

  it("координаты не попадают в фильтры и в их счётчики (кр. 9)", async () => {
    const withNear = setup();
    const without = setup(makeLocation({ permission: "unsupported" }));
    await waitFor(() => expect(searchRestaurants).toHaveBeenCalledTimes(2));
    expect(withNear.result.current.activeFilterCount).toBe(without.result.current.activeFilterCount);
    expect(withNear.result.current.hasActiveSearch).toBe(without.result.current.hasActiveSearch);
    expect(describeFilters(withNear.result.current.filters)).toEqual(
      describeFilters(without.result.current.filters),
    );
    expect(countActiveFilters(withNear.result.current.filters)).toBe(0);
    expect(withNear.result.current.hasActiveSearch).toBe(false);
  });

  it("без разрешения запрос уходит без near", async () => {
    const { result } = setup(makeLocation({ permission: "denied" }));
    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    expect(searchRestaurants.mock.calls[0]?.[0]).toEqual({ text: "", filters: EMPTY_FILTERS });
    expect(result.current.sortedByDistance).toBe(false);
  });

  it("при тексте near не уходит, после стирания возвращается (3.12)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { result } = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    act(() => result.current.setText("суши"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const typed = searchRestaurants.mock.calls.at(-1)?.[0] as { near?: unknown; text: string };
    expect(typed.text).toBe("суши");
    expect(typed.near).toBeUndefined();
    expect(result.current.sortedByDistance).toBe(false);

    act(() => result.current.setText(""));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.sortedByDistance).toBe(true);
    vi.useRealTimers();
  });

  it("catalog_distance_sort_applied: раз за визит, только surface (кр. 28)", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.sortedByDistance).toBe(true));
    act(() => result.current.applyNearPoint({ lat: 43.3, lng: 76.9 }));
    await act(async () => {});
    const sortEvents = trackEvent.mock.calls.filter(([n]) => n === "catalog_distance_sort_applied");
    expect(sortEvents).toEqual([["catalog_distance_sort_applied", { surface: "mobile_search_card" }]]);
  });

  it("applyNearPoint после «Разрешить» перезапрашивает с координатами (кр. 14)", async () => {
    const loc = makeLocation({ permission: "undetermined" });
    const { result } = setup(loc);
    await waitFor(() => expect(searchRestaurants).toHaveBeenCalledTimes(1));
    expect((searchRestaurants.mock.calls[0]?.[0] as { near?: unknown }).near).toBeUndefined();
    act(() => result.current.applyNearPoint({ lat: 43.2381, lng: 76.9452 }));
    await waitFor(() => expect(searchRestaurants).toHaveBeenCalledTimes(2));
    expect((searchRestaurants.mock.calls[1]?.[0] as { near?: unknown }).near).toEqual({
      lat: 43.238,
      lng: 76.945,
    });
  });
});
