import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { AdminApiError } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PricingCard, type PricingClient } from "../PricingCard";

/**
 * «Средний чек» у ВЫКЛЮЧЕННОГО заведения не открывался: карточка читала
 * заведение публичной ручкой каталога, та отвечала на скрытое заведение 404, а
 * панель показывала «Не удалось загрузить. Проверьте соединение». Чтение
 * переехало на кабинетную ручку — она отдаёт и выключенные, — но 404 остался
 * возможен: id с другого сервера, удалённое заведение, снятые права. Здесь
 * проверяется, что эти два случая больше не выглядят одинаково.
 */

const RESTAURANT_ID = "r-1";

function renderCard(client: PricingClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PricingCard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("PricingCard", () => {
  it("прочитанный чек показывает форму, а не ошибку", async () => {
    const client: PricingClient = {
      getRestaurantPricing: vi
        .fn()
        .mockResolvedValue({ price_category: "₸₸", price_range: { min: 5000, max: 15000 } }),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByRole("button", { name: /^сохранить$/i })).toBeTruthy();
    expect(client.getRestaurantPricing).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it("404 на заведении — «выберите другое», без кнопки «Повторить»", async () => {
    const client: PricingClient = {
      getRestaurantPricing: vi.fn().mockRejectedValue(new AdminApiError("not found", 404)),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText("Заведение недоступно")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /повторить/i })).toBeNull();
  });

  it("сбой связи остаётся сбоем связи — с повтором", async () => {
    const client: PricingClient = {
      getRestaurantPricing: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByRole("button", { name: /повторить/i })).toBeTruthy();
    expect(screen.queryByText("Заведение недоступно")).toBeNull();
  });
});
