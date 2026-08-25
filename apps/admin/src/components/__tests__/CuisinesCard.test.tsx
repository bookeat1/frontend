import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CuisineDictionaryEntry } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CuisinesCard, type VenueCuisinesClient } from "../CuisinesCard";

/**
 * «Кухни» в настройках заведения. Набор сервер ЗАМЕЩАЕТ целиком
 * (PUT /restaurants/:id/cuisines), поэтому проверяется то же, что у соцсетей:
 * сохранять можно только после чтения текущего набора, и уходит ВЕСЬ список — с
 * порядком, потому что первая позиция это главная кухня.
 */

const RESTAURANT_ID = "r-1";

function entry(over: Partial<CuisineDictionaryEntry> = {}): CuisineDictionaryEntry {
  return {
    id: "c-1",
    code: "kazakh",
    name: "Казахская",
    display_order: 1,
    is_active: true,
    ...over,
  };
}

const DICTIONARY: CuisineDictionaryEntry[] = [
  entry({ id: "c-1", code: "kazakh", name: "Казахская", display_order: 1 }),
  entry({ id: "c-2", code: "italian", name: "Итальянская", display_order: 2 }),
  entry({ id: "c-3", code: "seafood", name: "Морская", display_order: 3 }),
  entry({ id: "c-4", code: "vegan", name: "Веган", display_order: 4, is_active: false }),
];

function renderCard(client: VenueCuisinesClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CuisinesCard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

function fakeClient(over: Partial<VenueCuisinesClient> = {}): VenueCuisinesClient {
  return {
    listCuisines: vi.fn().mockResolvedValue(DICTIONARY),
    getRestaurantCuisines: vi.fn().mockResolvedValue([]),
    setRestaurantCuisines: vi.fn().mockResolvedValue([]),
    ...over,
  };
}

afterEach(cleanup);

describe("CuisinesCard", () => {
  it("сохраняет ВЕСЬ набор с порядком: первая кухня — главная", async () => {
    const client = fakeClient({
      getRestaurantCuisines: vi.fn().mockResolvedValue([entry({ id: "c-1" })]),
    });
    renderCard(client);

    fireEvent.click(await screen.findByRole("button", { name: /Добавить кухню «Морская»/i }));
    fireEvent.click(screen.getByRole("button", { name: /Сделать «Морская» главной/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    await waitFor(() =>
      expect(client.setRestaurantCuisines).toHaveBeenCalledWith(RESTAURANT_ID, ["c-3", "c-1"]),
    );
    expect(await screen.findByText(/^Сохранено$/)).toBeTruthy();
  });

  it("снятая кухня уходит набором БЕЗ неё, пустой набор отправляется как пустой", async () => {
    const client = fakeClient({
      getRestaurantCuisines: vi.fn().mockResolvedValue([entry({ id: "c-1" })]),
    });
    renderCard(client);

    fireEvent.click(await screen.findByRole("button", { name: /Убрать кухню «Казахская»/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    await waitFor(() =>
      expect(client.setRestaurantCuisines).toHaveBeenCalledWith(RESTAURANT_ID, []),
    );
  });

  it("скрытую кухню выбрать нельзя — сервер её всё равно не примет", async () => {
    const client = fakeClient();
    renderCard(client);

    await screen.findByRole("button", { name: /Добавить кухню «Казахская»/i });
    expect(screen.queryByRole("button", { name: /Добавить кухню «Веган»/i })).toBeNull();
  });

  it("не даёт сохранить, пока текущий набор не прочитан", async () => {
    const client = fakeClient({
      getRestaurantCuisines: vi.fn().mockRejectedValue(new Error("нет сети")),
    });
    renderCard(client);

    expect(await screen.findByText(/Кухни не загрузились/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Сохранить$/i })).toBeNull();
    expect(client.setRestaurantCuisines).not.toHaveBeenCalled();
  });

  it("неудачное сохранение видно и выбор человека не теряется", async () => {
    const client = fakeClient({
      getRestaurantCuisines: vi.fn().mockResolvedValue([]),
      setRestaurantCuisines: vi.fn().mockRejectedValue(new Error("500")),
    });
    renderCard(client);

    fireEvent.click(await screen.findByRole("button", { name: /Добавить кухню «Казахская»/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Не удалось сохранить кухни");
    expect(screen.getByRole("button", { name: /Убрать кухню «Казахская»/i })).toBeTruthy();
  });
});
