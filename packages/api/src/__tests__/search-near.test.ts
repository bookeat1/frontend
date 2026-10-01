import { afterEach, describe, expect, it, vi } from "vitest";
import { roundGeoPoint } from "../geo";
import { HttpRestaurantRepository } from "../http-repository";
import { EMPTY_FILTERS } from "../types";

/**
 * Геопозиция в каталоге (спека geolocation-permission.md, критерии 7-9):
 * уходит округлённой до 3 знаков, только без текста, без токена.
 */

const BASE_URL = "https://api.example.test/api/v1";

function repository() {
  return new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "secret-token" });
}

function captureSearch() {
  const seen: { url: string; headers: Headers }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), headers: new Headers(init?.headers) });
      return new Response(JSON.stringify({ data: { items: [], total: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return () => {
    const call = seen.find((c) => c.url.includes("/restaurants/search"));
    if (!call) throw new Error("search request was not made");
    return { url: new URL(call.url), headers: call.headers };
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("near в searchRestaurants", () => {
  it("шлёт lat/lng ровно с тремя знаками и без Authorization", async () => {
    const last = captureSearch();
    await repository().searchRestaurants({
      text: "",
      filters: EMPTY_FILTERS,
      near: { lat: 43.238123, lng: 76.945678 },
    });
    const { url, headers } = last();
    expect(url.searchParams.get("lat")).toBe("43.238");
    expect(url.searchParams.get("lng")).toBe("76.946");
    expect(headers.get("authorization")).toBeNull();
  });

  it("не шлёт координаты без near", async () => {
    const last = captureSearch();
    await repository().searchRestaurants({ text: "", filters: EMPTY_FILTERS });
    const { url } = last();
    expect(url.searchParams.has("lat")).toBe(false);
    expect(url.searchParams.has("lng")).toBe(false);
  });

  it("не шлёт координаты при непустом тексте", async () => {
    const last = captureSearch();
    await repository().searchRestaurants({
      text: "  суши ",
      filters: EMPTY_FILTERS,
      near: { lat: 43.238, lng: 76.945 },
    });
    const { url } = last();
    expect(url.searchParams.get("q")).toBe("суши");
    expect(url.searchParams.has("lat")).toBe(false);
    expect(url.searchParams.has("lng")).toBe(false);
  });

  it("пробел вместо текста считается пустым запросом", async () => {
    const last = captureSearch();
    await repository().searchRestaurants({
      text: "   ",
      filters: EMPTY_FILTERS,
      near: { lat: 43.238, lng: 76.945 },
    });
    expect(last().url.searchParams.get("lat")).toBe("43.238");
  });

  it("мусорную пару молча отбрасывает", async () => {
    const last = captureSearch();
    await repository().searchRestaurants({
      text: "",
      filters: EMPTY_FILTERS,
      near: { lat: Number.NaN, lng: 76.9 },
    });
    expect(last().url.searchParams.has("lat")).toBe(false);
    expect(last().url.searchParams.has("lng")).toBe(false);
  });
});

describe("roundGeoPoint", () => {
  it("округляет до 3 знаков", () => {
    expect(roundGeoPoint({ lat: 43.2381, lng: 76.9452 })).toEqual({ lat: 43.238, lng: 76.945 });
  });

  it("отбрасывает NaN, бесконечность и выход за диапазон", () => {
    expect(roundGeoPoint({ lat: Infinity, lng: 1 })).toBeUndefined();
    expect(roundGeoPoint({ lat: 91, lng: 0 })).toBeUndefined();
    expect(roundGeoPoint({ lat: 0, lng: 181 })).toBeUndefined();
    expect(roundGeoPoint(undefined)).toBeUndefined();
  });

  it("не отдаёт отрицательный ноль", () => {
    const r = roundGeoPoint({ lat: -0.0004, lng: 0 });
    expect(Object.is(r?.lat, -0)).toBe(false);
  });
});
