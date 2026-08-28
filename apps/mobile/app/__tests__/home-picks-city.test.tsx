import type { RestaurantSummary } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import * as SecureStore from "expo-secure-store";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PREFERRED_CITY_QUERY_KEY } from "../../src/lib/preferred-city";

/**
 * «ВЫБРАЛИ ДЛЯ ВАС» — ГОРОДСКОЙ ЗАПРОС В НОВУЮ РУЧКУ.
 *
 * Блок ходил в `GET /restaurants?is_popular=true` и города не передавал вовсе:
 * гость в Астане видел ту же подборку, что и гость в Алматы. Теперь блок ходит
 * в `GET /restaurants/picks`, где владелец может задать состав руками, — и
 * ручной список у каждого города СВОЙ, поэтому запрос без города показывал бы
 * чужую подборку молча, без единой ошибки на экране.
 *
 * Здесь закреплены обе половины городского запроса, которые ломаются тихо:
 *   1. город реально уходит в ручку (и это город УСТРОЙСТВА, а не откат);
 *   2. пока город неизвестен, запроса нет вообще — иначе на холодном старте
 *      сначала приедет подборка откатного города, а через мгновение своя, и
 *      это видно глазом.
 *
 * Хук монтируется зондом, а не через экран главной: проверяется аргумент
 * запроса, и зависеть от вёрстки блоков ему незачем (тот же приём, что в
 * home-guest-city.test.tsx).
 */

const PREFERRED_CITY_KEY = "bookeat.city.v1";
const t = getDictionary("ru");

const getRecommendedRestaurants =
  vi.fn<(city?: string, limit?: number) => Promise<RestaurantSummary[]>>();
const getMe = vi.fn();
const authStatus = { value: "signed-out" as "loading" | "signed-out" | "signed-in" };

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getRecommendedRestaurants }),
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: authStatus.value, repository: { getMe, updateMe: vi.fn() } }),
}));

vi.mock("../../src/lib/locale", async () => {
  const { getDictionary: dictionary } = await import("@bookeat/i18n");
  return {
    useLocale: () => ({ locale: "ru", dictionary: dictionary("ru"), setLocale: vi.fn() }),
  };
});

const { useRecommendedRestaurants } = await import(
  "../../src/components/explore/use-explore-data"
);

function PicksProbe() {
  useRecommendedRestaurants();
  return null;
}

function renderProbe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PicksProbe />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  authStatus.value = "signed-out";
  getRecommendedRestaurants.mockReset().mockResolvedValue([]);
  getMe.mockReset();
  await SecureStore.deleteItemAsync(PREFERRED_CITY_KEY);
});

describe("«Выбрали для вас»", () => {
  it("спрашивает подборку у ручки picks и передаёт город", async () => {
    await SecureStore.setItemAsync(PREFERRED_CITY_KEY, "Астана");

    renderProbe();

    await waitFor(() => expect(getRecommendedRestaurants).toHaveBeenCalled());
    const [city, limit] = getRecommendedRestaurants.mock.calls[0];
    expect(city).toBe("Астана");
    // Ограничение уходит НА СЕРВЕР: обрезка на клиенте молча съела бы хвост
    // ручного списка владельца.
    expect(typeof limit).toBe("number");
    expect(limit).toBeGreaterThan(0);
  });

  it("без выбранного города спрашивает город по умолчанию, а не «все города»", async () => {
    renderProbe();

    await waitFor(() => expect(getRecommendedRestaurants).toHaveBeenCalled());
    expect(getRecommendedRestaurants.mock.calls[0][0]).toBe(t.explore.cityFallback);
  });

  it("пока город неизвестен, запроса нет вообще", async () => {
    // Авторизация ещё поднимается, города устройства нет: в этот момент любой
    // городской запрос ушёл бы за откатным городом.
    authStatus.value = "loading";

    renderProbe();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getRecommendedRestaurants).not.toHaveBeenCalled();
  });

  it("после смены города спрашивает заново — город лежит в ключе кэша", async () => {
    await SecureStore.setItemAsync(PREFERRED_CITY_KEY, "Астана");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PicksProbe />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(getRecommendedRestaurants).toHaveBeenLastCalledWith("Астана", expect.any(Number)),
    );

    // Ровно то, что делает пикер города: пишет выбор в общий кэш устройства.
    // ТОТ ЖЕ QueryClient — если бы города в ключе подборки не было, react-query
    // отдал бы кэш Астаны и второго запроса не случилось бы вовсе.
    await act(async () => {
      client.setQueryData(PREFERRED_CITY_QUERY_KEY, "Алматы");
    });

    await waitFor(() =>
      expect(getRecommendedRestaurants).toHaveBeenLastCalledWith("Алматы", expect.any(Number)),
    );
  });
});
