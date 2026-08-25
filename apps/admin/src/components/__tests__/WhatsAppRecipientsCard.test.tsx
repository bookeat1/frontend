import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  AdminApiError,
  type RestaurantManager,
  type SetManagerWhatsAppInput,
  type WhatsAppSettings,
} from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WhatsAppRecipientsCard,
  type WhatsAppRecipientsClient,
} from "../WhatsAppRecipientsCard";

/**
 * Одна карточка на весь канал WhatsApp. Под охраной три вещи, каждая из
 * которых уже стоила заведению молчащих оповещений:
 *
 *  1. Номер показывается СЕРВЕРНЫЙ. Управляющий вводит «8 701…», видит
 *     «8 701…», считает, что всё сделано правильно, а нажатия кнопки в
 *     сообщении приходят с «+7 701…» и не находят его заведение. Ошибки при
 *     этом нет — просто тишина, и причину будут искать где угодно.
 *  2. Галочка «присылать брони» без номера НЕ отправляется: «включено и
 *     молчит» выглядит как работающее оповещение (сервер отвечает 422).
 *  3. Карточка отвечает на вопрос «придёт ли бронь хоть кому-нибудь» —
 *     перечисляет адресатов, а когда их нет, говорит это прямо. Прежний
 *     зелёный значок «Подключено» обещал больше, чем канал делал.
 */

const RESTAURANT_ID = "r-1";
const OWNER_USER = "u-owner";

function settings(overrides: Partial<WhatsAppSettings> = {}): WhatsAppSettings {
  return { connected: false, whatsapp_phone: "", enabled: true, ...overrides };
}

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

interface FakeOptions {
  settings?: WhatsAppSettings;
  managers?: RestaurantManager[];
  listManagers?: () => Promise<RestaurantManager[]>;
  onPatch?: (body: SetManagerWhatsAppInput) => RestaurantManager | Promise<RestaurantManager>;
  setWhatsAppPhone?: (phone: string) => Promise<WhatsAppSettings>;
  clearWhatsAppSettings?: () => Promise<void>;
}

function fakeClient(
  options: FakeOptions = {},
): WhatsAppRecipientsClient & { patches: SetManagerWhatsAppInput[] } {
  const managers = options.managers ?? [];
  const patches: SetManagerWhatsAppInput[] = [];
  return {
    patches,
    getWhatsAppSettings: vi.fn(async () => options.settings ?? settings()),
    setWhatsAppPhone: vi.fn(async (_r: string, phone: string) =>
      options.setWhatsAppPhone
        ? options.setWhatsAppPhone(phone)
        : settings({ connected: true, whatsapp_phone: phone }),
    ),
    clearWhatsAppSettings: vi.fn(async () =>
      options.clearWhatsAppSettings ? options.clearWhatsAppSettings() : undefined,
    ),
    listManagers: vi.fn(async () =>
      options.listManagers ? options.listManagers() : managers,
    ),
    setManagerWhatsApp: vi.fn(async (_r: string, _id: string, body: SetManagerWhatsAppInput) => {
      patches.push(body);
      if (options.onPatch) return options.onPatch(body);
      return manager({ ...managers[0], ...body, whatsapp_phone: body.whatsapp_phone ?? null });
    }),
  };
}

function renderCard(client: WhatsAppRecipientsClient, isPlatformAdmin = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WhatsAppRecipientsCard
        restaurantId={RESTAURANT_ID}
        actorUserId={OWNER_USER}
        isPlatformAdmin={isPlatformAdmin}
        client={client}
      />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("WhatsAppRecipientsCard — номер заведения", () => {
  it("показывает номер, который сохранил СЕРВЕР, а не тот, что набрали", async () => {
    const client = fakeClient({
      setWhatsAppPhone: async () =>
        settings({ connected: true, whatsapp_phone: "+77010000001" }),
    });
    renderCard(client);

    const input = await screen.findByLabelText<HTMLInputElement>(/^Номер WhatsApp/);
    fireEvent.change(input, { target: { value: "8 701 000 00 01" } });
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    await waitFor(() =>
      expect(client.setWhatsAppPhone).toHaveBeenCalledWith(RESTAURANT_ID, "8 701 000 00 01"),
    );
    // Набрали в местном формате — в поле должен оказаться международный.
    await waitFor(() => expect(input.value).toBe("+77010000001"));
  });

  it("пустое поле не отправляется на сервер — это опечатка, а не отключение", async () => {
    const client = fakeClient();
    renderCard(client);

    await screen.findByLabelText(/^Номер WhatsApp/);
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/укажите номер/i);
    expect(client.setWhatsAppPhone).not.toHaveBeenCalled();
  });

  it("отказ сервера показывается человеку, а не проглатывается", async () => {
    const client = fakeClient({
      setWhatsAppPhone: async () => {
        throw new AdminApiError("422", 422);
      },
    });
    renderCard(client);

    const input = await screen.findByLabelText(/^Номер WhatsApp/);
    fireEvent.change(input, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /подключить/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/проверьте номер/i);
  });

  it("кнопка отключения появляется только у подключённого номера", async () => {
    const connected = fakeClient({
      settings: settings({ connected: true, whatsapp_phone: "+77010000001" }),
    });
    renderCard(connected);

    await screen.findByText("Текущий номер: +77010000001");
    fireEvent.click(screen.getByRole("button", { name: /отключить/i }));
    await waitFor(() => expect(connected.clearWhatsAppSettings).toHaveBeenCalledWith(RESTAURANT_ID));

    cleanup();

    renderCard(fakeClient());
    await screen.findByLabelText(/^Номер WhatsApp/);
    expect(screen.queryByRole("button", { name: /отключить/i })).toBeNull();
  });
});

describe("WhatsAppRecipientsCard — сотрудники", () => {
  it("не даёт включить оповещения без номера и объясняет почему", async () => {
    const client = fakeClient({ managers: [manager()] });
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
    const client = fakeClient({ managers: [manager()] });
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", {
      name: /Присылать брони в WhatsApp/,
    });
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByLabelText(/^Личный номер WhatsApp/), {
      target: { value: "8 707 000 00 01" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.patches).toHaveLength(1));
    expect(client.patches[0]).toEqual({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" });
    expect((await screen.findByText("Сохранено")).textContent).toBe("Сохранено");
  });

  it("владельцу видно, кто уже покрыт, а кто нет", async () => {
    const client = fakeClient({
      managers: [
        manager({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" }),
        manager({ id: "m-2", user_id: "u-2", role: "hostess" }),
      ],
    });
    renderCard(client);

    expect(await screen.findByText("Брони приходят")).toBeTruthy();
    expect(screen.getByText("Брони не приходят")).toBeTruthy();
    expect(screen.getByText("Номер: +77070000001")).toBeTruthy();
    expect(screen.getByText("Номер не указан")).toBeTruthy();
  });

  it("не показывает контрол на строке, которую этот человек менять не вправе", async () => {
    const client = fakeClient({
      managers: [manager(), manager({ id: "m-2", user_id: "u-2", role: "owner" })],
    });
    renderCard(client);

    // Своя строка правится, строка второго владельца — только на чтение.
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(1));
    expect(screen.getByText("Меняет сам сотрудник или платформа")).toBeTruthy();
  });

  it("на 403 списка показывает объяснение, а не «попробуйте ещё раз»", async () => {
    const client = fakeClient({
      listManagers: async () => {
        throw new AdminApiError("forbidden", 403);
      },
    });
    renderCard(client);

    expect(await screen.findByText("Список сотрудников недоступен")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
    // Номер заведения при этом остаётся редактируемым: это другая половина
    // карточки, и роль без доступа к персоналу свою часть не теряет.
    expect(screen.getByLabelText(/^Номер WhatsApp/)).toBeTruthy();
  });

  it("на 422 от сервера оставляет набранное и говорит человеческим текстом", async () => {
    const client = fakeClient({
      managers: [manager()],
      onPatch: () => {
        throw new AdminApiError("validation failed", 422);
      },
    });
    renderCard(client);

    const checkbox = await screen.findByRole("checkbox", {
      name: /Присылать брони в WhatsApp/,
    });
    fireEvent.click(checkbox);
    const input = screen.getByLabelText(/^Личный номер WhatsApp/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "+7 707 000 00 01" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Сервер не принял номер. Проверьте его и попробуйте ещё раз",
    );
    expect(input.value).toBe("+7 707 000 00 01");
  });
});

describe("WhatsAppRecipientsCard — сводка «кто получит»", () => {
  it("перечисляет адресатов: номер заведения и согласившегося сотрудника", async () => {
    const client = fakeClient({
      settings: settings({ connected: true, whatsapp_phone: "+77010000001" }),
      managers: [
        manager({ role: "hostess", whatsapp_opt_in: true, whatsapp_phone: "+77070000001" }),
      ],
    });
    renderCard(client);

    expect(await screen.findByText("Сообщения получают")).toBeTruthy();
    expect(screen.getByText("Номер заведения — +77010000001")).toBeTruthy();
    expect(screen.getByText("Хостес — +77070000001")).toBeTruthy();
    expect(screen.queryByText("Сообщения о бронях сейчас не получает никто")).toBeNull();
  });

  it("без номера заведения и без согласий говорит прямо, что не получит никто", async () => {
    const client = fakeClient({ managers: [manager()] });
    renderCard(client);

    expect(await screen.findByText("Сообщения о бронях сейчас не получает никто")).toBeTruthy();
    expect(
      screen.getByText("Укажите номер заведения или включите сообщения сотруднику ниже."),
    ).toBeTruthy();
  });

  it("выключенный канал заведения объясняет, что молчит и для сотрудников", async () => {
    const client = fakeClient({
      settings: settings({ connected: true, whatsapp_phone: "+77010000001", enabled: false }),
      managers: [manager({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" })],
    });
    renderCard(client);

    expect(await screen.findByText("Сообщения о бронях сейчас не получает никто")).toBeTruthy();
    expect(
      screen.getByText(
        "Канал WhatsApp у заведения выключен, поэтому брони не приходят даже сотрудникам с согласием.",
      ),
    ).toBeTruthy();
    // Номер заведения в сводке не значится: рубильник выключен.
    expect(screen.queryByText("Номер заведения — +77010000001")).toBeNull();
  });

  it("роли без доступа к персоналу не обещает полноты картины", async () => {
    const client = fakeClient({
      settings: settings({ connected: true, whatsapp_phone: "+77010000001" }),
      listManagers: async () => {
        throw new AdminApiError("forbidden", 403);
      },
    });
    renderCard(client);

    const summary = (await screen.findByText("Сообщения получают")).parentElement as HTMLElement;
    expect(within(summary).getByText("Номер заведения — +77010000001")).toBeTruthy();
    // «Никому» тут сказать нельзя: сотрудники могут быть подключены, просто их
    // не видно.
    expect(screen.queryByText("Сообщения о бронях сейчас не получает никто")).toBeNull();
    expect(
      screen.getByText("Кому из сотрудников приходят брони, в этой роли не видно."),
    ).toBeTruthy();
  });
});
