import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WhatsAppSettings } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WhatsAppNotificationCard, type WhatsAppClient } from "../WhatsAppNotificationCard";

/**
 * Номер WhatsApp — не просто контакт: им же будет опознаваться нажатие кнопки
 * «подтвердить» в сообщении, которое придёт нам обратно. Сервер поэтому
 * приводит номер к международному виду и возвращает СВОЙ вариант.
 *
 * Что ломается для живого человека, если карточка начнёт показывать набранное
 * вместо сохранённого: управляющий вводит «8 701…», видит «8 701…», считает,
 * что всё сделано правильно, а нажатия приходят с «+7 701…» и не находят его
 * заведение. Уведомления при этом не падают с ошибкой — они просто молчат, и
 * искать причину будут в чём угодно, кроме этого поля.
 */

const RESTAURANT_ID = "r-1";

function settings(overrides: Partial<WhatsAppSettings> = {}): WhatsAppSettings {
  return { connected: false, whatsapp_phone: "", enabled: true, ...overrides };
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
  it("показывает номер, который сохранил СЕРВЕР, а не тот, что набрали", async () => {
    const client: WhatsAppClient = {
      getWhatsAppSettings: vi.fn().mockResolvedValue(settings()),
      setWhatsAppPhone: vi
        .fn()
        .mockResolvedValue(settings({ connected: true, whatsapp_phone: "+77010000001" })),
      clearWhatsAppSettings: vi.fn().mockResolvedValue(undefined),
    };
    renderCard(client);

    const input = await screen.findByLabelText<HTMLInputElement>(/номер whatsapp/i);
    fireEvent.change(input, { target: { value: "8 701 000 00 01" } });
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    await waitFor(() => expect(client.setWhatsAppPhone).toHaveBeenCalledWith(RESTAURANT_ID, "8 701 000 00 01"));
    // Набрали в местном формате — в поле должен оказаться международный.
    await waitFor(() => expect(input.value).toBe("+77010000001"));
  });

  it("пустое поле не отправляется на сервер — это опечатка, а не отключение", async () => {
    const client: WhatsAppClient = {
      getWhatsAppSettings: vi.fn().mockResolvedValue(settings()),
      setWhatsAppPhone: vi.fn(),
      clearWhatsAppSettings: vi.fn(),
    };
    renderCard(client);

    await screen.findByLabelText(/номер whatsapp/i);
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/укажите номер/i);
    expect(client.setWhatsAppPhone).not.toHaveBeenCalled();
  });

  it("отказ сервера показывается человеку, а не проглатывается", async () => {
    const client: WhatsAppClient = {
      getWhatsAppSettings: vi.fn().mockResolvedValue(settings()),
      setWhatsAppPhone: vi.fn().mockRejectedValue(new Error("422")),
      clearWhatsAppSettings: vi.fn(),
    };
    renderCard(client);

    const input = await screen.findByLabelText(/номер whatsapp/i);
    fireEvent.change(input, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/проверьте номер/i);
  });

  it("кнопка отключения появляется только у подключённого номера", async () => {
    const connected: WhatsAppClient = {
      getWhatsAppSettings: vi
        .fn()
        .mockResolvedValue(settings({ connected: true, whatsapp_phone: "+77010000001" })),
      setWhatsAppPhone: vi.fn(),
      clearWhatsAppSettings: vi.fn().mockResolvedValue(undefined),
    };
    renderCard(connected);

    await screen.findByText(/текущий номер: \+77010000001/i);
    fireEvent.click(screen.getByRole("button", { name: /отключить/i }));
    await waitFor(() => expect(connected.clearWhatsAppSettings).toHaveBeenCalledWith(RESTAURANT_ID));

    cleanup();

    const fresh: WhatsAppClient = {
      getWhatsAppSettings: vi.fn().mockResolvedValue(settings()),
      setWhatsAppPhone: vi.fn(),
      clearWhatsAppSettings: vi.fn(),
    };
    renderCard(fresh);
    await screen.findByLabelText(/номер whatsapp/i);
    expect(screen.queryByRole("button", { name: /отключить/i })).toBeNull();
  });
});
