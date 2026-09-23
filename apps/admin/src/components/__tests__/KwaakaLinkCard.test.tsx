import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminApiError } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KwaakaLinkCard, type KwaakaLinkClient } from "../KwaakaLinkCard";

/**
 * `kwaaka_restaurant_id` is superadmin-only, stripped by the backend for a
 * venue manager — same visibility contract as `is_premium`/`display_order`.
 * The card itself does not check the role (SettingsView gates its mount), so
 * these tests only cover what the card owns: showing the current link (or
 * «не привязан»), 404/403 on the venue itself, a network failure, and the two
 * PATCH shapes — a new id, and an explicit `null` to unlink.
 */

const RESTAURANT_ID = "r-1";

function renderCard(client: KwaakaLinkClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <KwaakaLinkCard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("KwaakaLinkCard", () => {
  it("непривязанное заведение показывает «не привязан», а не ошибку", async () => {
    const client: KwaakaLinkClient = {
      getRestaurantKwaakaLink: vi.fn().mockResolvedValue({ kwaaka_restaurant_id: null }),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText("не привязан")).toBeTruthy();
    expect(client.getRestaurantKwaakaLink).toHaveBeenCalledWith(RESTAURANT_ID);
  });

  it("привязанное заведение показывает текущий ID", async () => {
    const client: KwaakaLinkClient = {
      getRestaurantKwaakaLink: vi.fn().mockResolvedValue({ kwaaka_restaurant_id: "kw-42" }),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText(/Сейчас привязано: kw-42/)).toBeTruthy();
  });

  it("404 на заведении — «выберите другое», без кнопки «Повторить»", async () => {
    const client: KwaakaLinkClient = {
      getRestaurantKwaakaLink: vi.fn().mockRejectedValue(new AdminApiError("not found", 404)),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText("Заведение недоступно")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /повторить/i })).toBeNull();
  });

  it("сбой связи остаётся сбоем связи — с повтором", async () => {
    const client: KwaakaLinkClient = {
      getRestaurantKwaakaLink: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByRole("button", { name: /повторить/i })).toBeTruthy();
    expect(screen.queryByText("Заведение недоступно")).toBeNull();
  });

  it("ввод нового ID шлёт PATCH с новым значением", async () => {
    const client: KwaakaLinkClient = {
      getRestaurantKwaakaLink: vi.fn().mockResolvedValue({ kwaaka_restaurant_id: null }),
      patchRestaurant: vi.fn().mockResolvedValue({}),
    };
    renderCard(client);

    const input = await screen.findByLabelText(/^ID заведения в Kwaaka/);
    fireEvent.change(input, { target: { value: "kw-99" } });
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    expect(await screen.findByText("Сохранено")).toBeTruthy();
    expect(client.patchRestaurant).toHaveBeenCalledWith(RESTAURANT_ID, {
      kwaaka_restaurant_id: "kw-99",
    });
  });

  it("очистка поля шлёт PATCH с null и показывает «Отвязано»", async () => {
    const client: KwaakaLinkClient = {
      getRestaurantKwaakaLink: vi.fn().mockResolvedValue({ kwaaka_restaurant_id: "kw-42" }),
      patchRestaurant: vi.fn().mockResolvedValue({}),
    };
    renderCard(client);

    const input = await screen.findByLabelText(/^ID заведения в Kwaaka/);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    expect(await screen.findByText("Отвязано")).toBeTruthy();
    expect(client.patchRestaurant).toHaveBeenCalledWith(RESTAURANT_ID, {
      kwaaka_restaurant_id: null,
    });
  });

  it("сохранение без изменений — «менять нечего», PATCH не уходит", async () => {
    const client: KwaakaLinkClient = {
      getRestaurantKwaakaLink: vi.fn().mockResolvedValue({ kwaaka_restaurant_id: "kw-42" }),
      patchRestaurant: vi.fn(),
    };
    renderCard(client);

    await screen.findByText(/Сейчас привязано: kw-42/);
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    expect(await screen.findByText("Ничего не изменилось — менять нечего")).toBeTruthy();
    expect(client.patchRestaurant).not.toHaveBeenCalled();
  });

  it("403 при сохранении — «менять может только суперадмин»", async () => {
    const client: KwaakaLinkClient = {
      getRestaurantKwaakaLink: vi.fn().mockResolvedValue({ kwaaka_restaurant_id: null }),
      patchRestaurant: vi.fn().mockRejectedValue(new AdminApiError("forbidden", 403)),
    };
    renderCard(client);

    const input = await screen.findByLabelText(/^ID заведения в Kwaaka/);
    fireEvent.change(input, { target: { value: "kw-99" } });
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    expect(await screen.findByText("Менять привязку может только суперадмин")).toBeTruthy();
  });
});
