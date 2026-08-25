import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { VenueFeatureDictionaryEntry } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VenueFeatureDictionary,
  type VenueFeatureDictionaryClient,
} from "../VenueFeaturesView";

/**
 * Экран справочника удобств (только платформа).
 *
 * Что тут закреплено: удаления НЕТ — DELETE на сервере снимает флаг
 * активности, вернуть можно PATCH-ем; порядок правится через display_order
 * пачкой PATCH-ей (отдельной ручки «поменять местами» у удобств нет, в отличие
 * от городов); и `venue_count` виден, потому что ноль здесь — это «данные ещё
 * не заполнены», а не «поле не поддерживается».
 */

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

const ITEMS: VenueFeatureDictionaryEntry[] = [
  entry({ id: "f-1", code: "terrace", name: "Терраса", display_order: 10, venue_count: 4 }),
  entry({ id: "f-2", code: "wifi", name: "Wi-Fi", display_order: 20, venue_count: 3 }),
  entry({ id: "f-3", code: "parking", name: "Парковка", display_order: 30, venue_count: 0 }),
  entry({
    id: "f-4",
    code: "hookah",
    name: "Кальян",
    display_order: 40,
    venue_count: 1,
    is_active: false,
  }),
];

function fakeClient(
  over: Partial<VenueFeatureDictionaryClient> = {},
): VenueFeatureDictionaryClient {
  return {
    listVenueFeaturesForAdmin: vi.fn().mockResolvedValue(ITEMS),
    createVenueFeature: vi.fn().mockResolvedValue(entry()),
    updateVenueFeature: vi.fn().mockResolvedValue(entry()),
    hideVenueFeature: vi.fn().mockResolvedValue(entry({ is_active: false })),
    ...over,
  };
}

function renderScreen(client: VenueFeatureDictionaryClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VenueFeatureDictionary client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("справочник удобств", () => {
  it("показывает название, код, порядок, у скольких заведений и видно ли удобство", async () => {
    renderScreen(fakeClient());

    const row = (await screen.findByText("Парковка")).closest("tr")!;
    expect(within(row).getByText("parking")).toBeTruthy();
    // Ноль заведений называется словами: «0» в столбце читается как «не
    // поддерживается», а это «данные ещё не заполнены».
    expect(within(row).getByText("Ни у кого")).toBeTruthy();

    const terrace = screen.getByText("Терраса").closest("tr")!;
    expect(within(terrace).getByText("4")).toBeTruthy();

    const hookah = screen.getByText("Кальян").closest("tr")!;
    expect(within(hookah).getByText("Скрыто")).toBeTruthy();
  });

  it("удаления нет: «Скрыть» зовёт DELETE, «Вернуть» — PATCH с is_active", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: "Скрыть удобство «Wi-Fi»" }));
    await waitFor(() => expect(client.hideVenueFeature).toHaveBeenCalledWith("f-2"));

    fireEvent.click(screen.getByRole("button", { name: "Вернуть удобство «Кальян»" }));
    await waitFor(() =>
      expect(client.updateVenueFeature).toHaveBeenCalledWith("f-4", { is_active: true }),
    );
  });

  it("перестановка — пачка PATCH-ей: своей ручки порядка у удобств нет", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: "Поднять удобство «Wi-Fi»" }));

    await waitFor(() => expect(client.updateVenueFeature).toHaveBeenCalledTimes(4));
    expect((client.updateVenueFeature as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      ["f-2", { display_order: 1 }],
      ["f-1", { display_order: 2 }],
      ["f-3", { display_order: 3 }],
      ["f-4", { display_order: 4 }],
    ]);
  });

  it("не легла хотя бы одна правка порядка — говорим прямо, а не молчим", async () => {
    const client = fakeClient({
      updateVenueFeature: vi.fn().mockRejectedValue(new Error("500")),
    });
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: "Поднять удобство «Wi-Fi»" }));
    expect(await screen.findByText(/Порядок сохранился не полностью/)).toBeTruthy();
  });

  it("новое удобство заводится с кодом; кириллица в коде отсекается до запроса", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: "Добавить удобство" }));
    fireEvent.change(screen.getByLabelText(/Название/), { target: { value: "  Кальян  " } });
    fireEvent.change(screen.getByLabelText(/Код/), { target: { value: "кальян" } });
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/ }));

    expect(await screen.findByText(/В коде можно только латиницу/)).toBeTruthy();
    expect(client.createVenueFeature).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Код/), { target: { value: "Hookah" } });
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/ }));

    await waitFor(() =>
      expect(client.createVenueFeature).toHaveBeenCalledWith({ name: "Кальян", code: "hookah" }),
    );
  });

  it("справочник не ответил — предлагаем повторить, а не показываем пустой список", async () => {
    const client = fakeClient({
      listVenueFeaturesForAdmin: vi.fn().mockRejectedValue(new Error("500")),
    });
    renderScreen(client);

    expect(await screen.findByText(/Справочник не загрузился/)).toBeTruthy();
    expect(screen.queryByText("Терраса")).toBeNull();
  });
});
