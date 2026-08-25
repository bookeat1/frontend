import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WhatsAppSettings } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WhatsAppNotificationCard, type WhatsAppClient } from "../WhatsAppNotificationCard";

/**
 * Карточка на один номер. Под охраной три вещи:
 *
 *  1. На сервер уходит ПРИВЕДЁННЫЙ номер, а в поле остаётся то, что сервер
 *     сохранил. Управляющий вводит «8 701…», а входящее нажатие кнопки в
 *     сообщении приходит с «+7 701…»: разойдись эти два вида — оповещения
 *     молчат, и причину будут искать где угодно.
 *  2. Состояние названо словами и с номером, без значка «Подключено»: значок
 *     обещал доставку и не говорил, куда именно.
 *  3. Отказ сервера виден человеку и не стирает набранное.
 */

const RESTAURANT_ID = "r-1";

function settings(overrides: Partial<WhatsAppSettings> = {}): WhatsAppSettings {
  return { connected: false, whatsapp_phone: "", enabled: true, ...overrides };
}

function fakeClient(options: {
  settings?: WhatsAppSettings;
  setWhatsAppPhone?: (phone: string) => Promise<WhatsAppSettings>;
  clearWhatsAppSettings?: () => Promise<void>;
} = {}): WhatsAppClient {
  return {
    getWhatsAppSettings: vi.fn(async () => options.settings ?? settings()),
    setWhatsAppPhone: vi.fn(async (_r: string, phone: string) =>
      options.setWhatsAppPhone
        ? options.setWhatsAppPhone(phone)
        : settings({ connected: true, whatsapp_phone: phone }),
    ),
    clearWhatsAppSettings: vi.fn(async () =>
      options.clearWhatsAppSettings ? options.clearWhatsAppSettings() : undefined,
    ),
  };
}

function renderCard(client: WhatsAppClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WhatsAppNotificationCard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("WhatsAppNotificationCard", () => {
  it("отправляет приведённый номер и показывает тот, что вернул сервер", async () => {
    const client = fakeClient({
      setWhatsAppPhone: async () => settings({ connected: true, whatsapp_phone: "+77010000001" }),
    });
    renderCard(client);

    const input = await screen.findByLabelText<HTMLInputElement>(/^Номер WhatsApp/);
    fireEvent.change(input, { target: { value: "8 701 000 00 01" } });
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    await waitFor(() =>
      expect(client.setWhatsAppPhone).toHaveBeenCalledWith(RESTAURANT_ID, "+77010000001"),
    );
    await waitFor(() => expect(input.value).toBe("+77010000001"));
  });

  it("состояние названо словами и с номером — вместо значка «Подключено»", async () => {
    renderCard(fakeClient({ settings: settings({ connected: true, whatsapp_phone: "+77010000001" }) }));

    expect(await screen.findByText(/Брони приходят на \+77010000001/)).toBeTruthy();
    expect(screen.queryByText("Подключено")).toBeNull();
  });

  it("без номера говорит прямо, что брони не приходят, и не предлагает отключение", async () => {
    renderCard(fakeClient());

    expect(await screen.findByText(/Номер не подключён/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /отключить/i })).toBeNull();
  });

  it("выключенный канал заведения не выдаёт за работающий", async () => {
    renderCard(
      fakeClient({
        settings: settings({ connected: true, whatsapp_phone: "+77010000001", enabled: false }),
      }),
    );

    expect(await screen.findByText(/Канал WhatsApp у заведения выключен/)).toBeTruthy();
  });

  it("пустое поле не отправляется — это опечатка, а не отключение", async () => {
    const client = fakeClient();
    renderCard(client);

    fireEvent.click(await screen.findByRole("button", { name: /подключить/i }));

    expect(await screen.findByText("Укажите номер")).toBeTruthy();
    await waitFor(() => expect(client.setWhatsAppPhone).not.toHaveBeenCalled());
  });

  it("недобранный номер отвергается до отправки", async () => {
    const client = fakeClient();
    renderCard(client);

    const input = await screen.findByLabelText<HTMLInputElement>(/^Номер WhatsApp/);
    fireEvent.change(input, { target: { value: "701 000" } });
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    expect(await screen.findByText(/Нужен номер вида/)).toBeTruthy();
    await waitFor(() => expect(client.setWhatsAppPhone).not.toHaveBeenCalled());
    // Набранное остаётся: человеку есть что исправлять.
    expect(input.value).toBe("701 000");
  });

  it("отключает номер и говорит об этом", async () => {
    const client = fakeClient({
      settings: settings({ connected: true, whatsapp_phone: "+77010000001" }),
    });
    renderCard(client);

    fireEvent.click(await screen.findByRole("button", { name: /отключить/i }));

    await waitFor(() => expect(client.clearWhatsAppSettings).toHaveBeenCalledWith(RESTAURANT_ID));
    expect(await screen.findByText("Номер отключён")).toBeTruthy();
  });

  it("отказ сервера показывается человеку и не стирает набранное", async () => {
    const client = fakeClient({
      setWhatsAppPhone: async () => {
        throw new Error("boom");
      },
    });
    renderCard(client);

    const input = await screen.findByLabelText<HTMLInputElement>(/^Номер WhatsApp/);
    fireEvent.change(input, { target: { value: "+7 701 000 00 01" } });
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    expect(await screen.findByText(/Не удалось подключить/)).toBeTruthy();
    expect(input.value).toBe("+7 701 000 00 01");
  });
});
