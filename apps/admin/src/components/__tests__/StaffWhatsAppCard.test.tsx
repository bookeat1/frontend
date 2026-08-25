import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminApiError, type RestaurantManager, type SetManagerWhatsAppInput } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffWhatsAppCard, type StaffWhatsAppClient } from "../StaffWhatsAppCard";

/**
 * REGRESSION GUARD для экрана: галочка «присылать брони» без номера НЕ
 * отправляется, а строка, которую этому человеку менять нельзя, не показывает
 * контрол, который упадёт 403.
 *
 * Первое — та самая пара, ради которой канал переделывали: «включено и молчит»
 * выглядит как работающее оповещение и не доставляет ничего (сервер отвечает
 * 422). Второе — про мёртвые контролы: владелец не может править второго
 * владельца, и кнопка, которая гарантированно откажет, хуже её отсутствия.
 */

const RESTAURANT_ID = "r-1";
const OWNER_USER = "u-owner";

function manager(patch: Partial<RestaurantManager> = {}): RestaurantManager {
  return {
    id: "m-owner",
    restaurant_id: RESTAURANT_ID,
    user_id: OWNER_USER,
    role: "owner",
    whatsapp_opt_in: false,
    whatsapp_phone: null,
    ...patch,
  };
}

function fakeClient(
  managers: RestaurantManager[],
  onPatch?: (body: SetManagerWhatsAppInput) => RestaurantManager | Promise<RestaurantManager>,
): StaffWhatsAppClient & { patches: SetManagerWhatsAppInput[] } {
  const patches: SetManagerWhatsAppInput[] = [];
  return {
    patches,
    listManagers: vi.fn(async () => managers),
    setManagerWhatsApp: vi.fn(
      async (_r: string, _id: string, body: SetManagerWhatsAppInput) => {
        patches.push(body);
        if (onPatch) return onPatch(body);
        return manager({ ...managers[0], ...body, whatsapp_phone: body.whatsapp_phone ?? null });
      },
    ),
  };
}

function renderCard(client: StaffWhatsAppClient, isPlatformAdmin = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StaffWhatsAppCard
        restaurantId={RESTAURANT_ID}
        actorUserId={OWNER_USER}
        isPlatformAdmin={isPlatformAdmin}
        client={client}
      />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("StaffWhatsAppCard", () => {
  it("не даёт включить оповещения без номера и объясняет почему", async () => {
    const client = fakeClient([manager()]);
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", {
      name: /Присылать брони в WhatsApp/,
    });
    fireEvent.click(checkbox);

    const save = screen.getByRole("button", { name: "Сохранить" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Чтобы присылать брони, укажите номер");

    // Даже если кнопку всё-таки нажать (клавиатурой по disabled браузер не
    // даст, но событие смоделировать можно) — запроса быть не должно.
    fireEvent.click(save);
    await waitFor(() => expect(client.setManagerWhatsApp).not.toHaveBeenCalled());
  });

  it("сохраняет согласие вместе с номером, приведённым к виду сервера", async () => {
    const client = fakeClient([manager()]);
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", {
      name: /Присылать брони в WhatsApp/,
    });
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByLabelText(/Номер WhatsApp/), {
      target: { value: "8 707 000 00 01" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.patches).toHaveLength(1));
    expect(client.patches[0]).toEqual({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" });
    expect((await screen.findByRole("status")).textContent).toBe("Сохранено");
  });

  it("владельцу видно, кто уже покрыт, а кто нет", async () => {
    const client = fakeClient([
      manager({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" }),
      manager({ id: "m-2", user_id: "u-2", role: "hostess" }),
    ]);
    renderCard(client);

    expect(await screen.findByText("Брони приходят")).toBeTruthy();
    expect(screen.getByText("Брони не приходят")).toBeTruthy();
    expect(screen.getByText("Номер: +77070000001")).toBeTruthy();
    expect(screen.getByText("Номер не указан")).toBeTruthy();
  });

  it("не показывает контрол на строке, которую этот человек менять не вправе", async () => {
    const client = fakeClient([
      manager(),
      manager({ id: "m-2", user_id: "u-2", role: "owner" }),
    ]);
    renderCard(client);

    // Своя строка правится, строка второго владельца — только на чтение.
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(1));
    expect(screen.getByText("Меняет сам сотрудник или платформа")).toBeTruthy();
  });

  it("на 403 списка показывает объяснение, а не «попробуйте ещё раз»", async () => {
    const client: StaffWhatsAppClient = {
      listManagers: vi.fn(async () => {
        throw new AdminApiError("forbidden", 403);
      }),
      setManagerWhatsApp: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText("Список сотрудников недоступен")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
  });

  it("на 422 от сервера оставляет набранное и говорит человеческим текстом", async () => {
    const client = fakeClient([manager()], () => {
      throw new AdminApiError("validation failed", 422);
    });
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", {
      name: /Присылать брони в WhatsApp/,
    });
    fireEvent.click(checkbox);
    const input = screen.getByLabelText(/Номер WhatsApp/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "+7 707 000 00 01" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Сервер не принял номер. Проверьте его и попробуйте ещё раз",
    );
    expect(input.value).toBe("+7 707 000 00 01");
  });
});
