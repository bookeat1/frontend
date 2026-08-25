import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { VenueFeatureDictionaryEntry } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VenueFeaturesCard, type VenueFeaturesClient } from "../VenueFeaturesCard";

/**
 * «Удобства» в настройках заведения. Набор сервер ЗАМЕЩАЕТ целиком
 * (PUT /restaurants/:id/features), поэтому проверяется то же, что у кухонь и
 * соцсетей: сохранять можно только после чтения текущего набора, и уходит ВЕСЬ
 * список — включая пустой, который означает «удобств нет».
 */

const RESTAURANT_ID = "r-1";

function entry(over: Partial<VenueFeatureDictionaryEntry> = {}): VenueFeatureDictionaryEntry {
  return {
    id: "f-1",
    code: "wifi",
    name: "Wi-Fi",
    display_order: 10,
    is_active: true,
    venue_count: 0,
    ...over,
  };
}

const DICTIONARY: VenueFeatureDictionaryEntry[] = [
  entry({ id: "f-1", code: "wifi", name: "Wi-Fi", display_order: 10 }),
  entry({ id: "f-2", code: "terrace", name: "Терраса", display_order: 20 }),
  entry({ id: "f-3", code: "parking", name: "Парковка", display_order: 30 }),
  entry({ id: "f-4", code: "hookah", name: "Кальян", display_order: 40, is_active: false }),
];

function fakeClient(over: Partial<VenueFeaturesClient> = {}): VenueFeaturesClient {
  return {
    listVenueFeatures: vi.fn().mockResolvedValue(DICTIONARY),
    getRestaurantFeatures: vi.fn().mockResolvedValue([]),
    setRestaurantFeatures: vi.fn().mockResolvedValue([]),
    ...over,
  };
}

function renderCard(client: VenueFeaturesClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VenueFeaturesCard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("VenueFeaturesCard", () => {
  it("отмеченное удобство уходит ОТДЕЛЬНОЙ ручкой полным набором", async () => {
    const client = fakeClient({
      getRestaurantFeatures: vi.fn().mockResolvedValue([entry({ id: "f-1" })]),
    });
    renderCard(client);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Терраса" }));
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/ }));

    await waitFor(() =>
      expect(client.setRestaurantFeatures).toHaveBeenCalledWith(RESTAURANT_ID, ["f-1", "f-2"]),
    );
    expect(await screen.findByText(/^Сохранено$/)).toBeTruthy();
  });

  it("снятая галочка уходит набором БЕЗ неё, пустой набор отправляется как пустой", async () => {
    const client = fakeClient({
      getRestaurantFeatures: vi.fn().mockResolvedValue([entry({ id: "f-1" })]),
    });
    renderCard(client);

    const wifi = await screen.findByRole("checkbox", { name: "Wi-Fi" });
    expect((wifi as HTMLInputElement).checked).toBe(true);
    fireEvent.click(wifi);
    expect((wifi as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/ }));

    await waitFor(() =>
      expect(client.setRestaurantFeatures).toHaveBeenCalledWith(RESTAURANT_ID, []),
    );
  });

  it("не прочитав текущий набор, сохранять не даёт вовсе", async () => {
    const client = fakeClient({
      getRestaurantFeatures: vi.fn().mockRejectedValue(new Error("500")),
    });
    renderCard(client);

    expect(await screen.findByText(/Удобства не загрузились/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Сохранить$/ })).toBeNull();
    expect(client.setRestaurantFeatures).not.toHaveBeenCalled();
  });

  it("скрытое платформой удобство не предлагается, но выбранное остаётся видимым", async () => {
    const client = fakeClient({
      getRestaurantFeatures: vi
        .fn()
        .mockResolvedValue([entry({ id: "f-4", code: "hookah", name: "Кальян", is_active: false })]),
    });
    renderCard(client);

    // Уже выбранное скрытое удобство видно и отмечено — иначе первое же
    // сохранение стёрло бы его молча.
    const hookah = await screen.findByRole("checkbox", { name: "Кальян" });
    expect((hookah as HTMLInputElement).checked).toBe(true);
  });

  it("ошибка сохранения не закрывает и не теряет отмеченное", async () => {
    const client = fakeClient({
      setRestaurantFeatures: vi.fn().mockRejectedValue(new Error("500")),
    });
    renderCard(client);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Терраса" }));
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/ }));

    expect(await screen.findByText(/Не удалось сохранить удобства/)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Терраса" }) as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
