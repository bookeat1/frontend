import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminApiError } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoyaltyCard, type LoyaltyClient } from "../LoyaltyCard";

/**
 * `loyalty_enabled` is superadmin-only to WRITE — stripped by the backend for
 * a venue manager's PATCH, same visibility contract as
 * `kwaaka_restaurant_id`/`is_premium`. The card itself does not check the
 * role (VenuesView gates its mount), so these tests only cover what the card
 * owns: showing the current on/off state, 404/403 on the venue itself, a
 * network failure, and the toggle's own save/no-op flow.
 */

const RESTAURANT_ID = "r-1";

function renderCard(client: LoyaltyClient, onDirtyChange?: (dirty: boolean) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoyaltyCard restaurantId={RESTAURANT_ID} client={client} onDirtyChange={onDirtyChange} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("LoyaltyCard", () => {
  it("загружает текущее состояние — выключено по умолчанию не рисует ошибку", async () => {
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn().mockResolvedValue({ loyalty_enabled: false }),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", { name: /Лояльность включена/ });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(client.getRestaurantLoyalty).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it("включённая настройка приходит отмеченным чекбоксом", async () => {
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn().mockResolvedValue({ loyalty_enabled: true }),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", { name: /Лояльность включена/ });
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it("404 на заведении — «выберите другое», без кнопки «Повторить»", async () => {
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn().mockRejectedValue(new AdminApiError("not found", 404)),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText("Заведение недоступно")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /повторить/i })).toBeNull();
  });

  it("сбой связи остаётся сбоем связи — с повтором", async () => {
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByRole("button", { name: /повторить/i })).toBeTruthy();
    expect(screen.queryByText("Заведение недоступно")).toBeNull();
  });

  it("включение шлёт PATCH {loyalty_enabled: true}", async () => {
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn().mockResolvedValue({ loyalty_enabled: false }),
      patchRestaurant: vi.fn().mockResolvedValue({}),
    };
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", { name: /Лояльность включена/ });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    expect(await screen.findByText("Сохранено")).toBeTruthy();
    expect(client.patchRestaurant).toHaveBeenCalledWith(RESTAURANT_ID, { loyalty_enabled: true });
  });

  it("выключение шлёт PATCH {loyalty_enabled: false}", async () => {
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn().mockResolvedValue({ loyalty_enabled: true }),
      patchRestaurant: vi.fn().mockResolvedValue({}),
    };
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", { name: /Лояльность включена/ });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    expect(await screen.findByText("Сохранено")).toBeTruthy();
    expect(client.patchRestaurant).toHaveBeenCalledWith(RESTAURANT_ID, { loyalty_enabled: false });
  });

  it("сохранение без изменений — «менять нечего», PATCH не уходит", async () => {
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn().mockResolvedValue({ loyalty_enabled: true }),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    await screen.findByRole("checkbox", { name: /Лояльность включена/ });
    // Кнопка «Сохранить» не даёт нажать себя, пока значение не менялось —
    // тот же disabled-по-`!dirty` приём, что у PaymentAcceptanceCard.
    const saveButton = screen.getByRole("button", { name: /^сохранить$/i }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(client.patchRestaurant).not.toHaveBeenCalled();
  });

  it("403 при сохранении — «менять может только суперадмин»", async () => {
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn().mockResolvedValue({ loyalty_enabled: false }),
      patchRestaurant: vi.fn().mockRejectedValue(new AdminApiError("forbidden", 403)),
    };
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", { name: /Лояльность включена/ });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    expect(await screen.findByText("Менять эту настройку может только суперадмин")).toBeTruthy();
  });

  it("сообщает родителю о несохранённом переключателе и снимает флаг после сохранения", async () => {
    // Стейтфул, а не статичный mockResolvedValue: реальный сервер после PATCH
    // отдаёт то, что реально сохранил, и именно это возвращение (через
    // инвалидацию запроса) переводит карточку обратно в «не грязно».
    let stored = false;
    const client: LoyaltyClient = {
      getRestaurantLoyalty: vi.fn(async () => ({ loyalty_enabled: stored })),
      patchRestaurant: vi.fn(async (_id, patch) => {
        stored = (patch as { loyalty_enabled?: boolean }).loyalty_enabled ?? stored;
        return {};
      }),
    };
    const onDirtyChange = vi.fn();
    renderCard(client, onDirtyChange);

    const checkbox = await screen.findByRole("checkbox", { name: /Лояльность включена/ });
    // Начальное состояние — «не грязно»: форма-родитель не обязана ждать
    // ничего, пока карточка ничего не тронула.
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(checkbox);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));
    await screen.findByText("Сохранено");

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
