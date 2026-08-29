import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AcquirerAccount, KaspiCompany } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PaymentAcceptanceCard,
  type PaymentAcceptanceClient,
} from "../PaymentAcceptanceCard";

/**
 * Карточка решает один вопрос: на чей счёт попадут деньги гостя. Под охраной
 * четыре вещи:
 *
 *  1. На сервер уходит ВЫБРАННЫЙ идентификатор компании, а в поле остаётся то,
 *     что сохранил сервер. Опечатка тут — это деньги в чужой кассе.
 *  2. Компания без живой сессии кассира названа словами. В Kaspi она выглядит
 *     «активной» и при этом не создаст ни одной ссылки на оплату.
 *  3. Недоступный сервис Kaspi — это сказанная вслух причина и запертое
 *     сохранение, а не пустой список, который читается как «компаний нет».
 *  4. Текущая привязка видна, даже когда список компаний не загрузился.
 */

const RESTAURANT_ID = "r-1";

function account(overrides: Partial<AcquirerAccount> = {}): AcquirerAccount {
  return { provider: "kaspi", connected: false, account_ref: "", is_active: false, ...overrides };
}

function company(overrides: Partial<KaspiCompany> = {}): KaspiCompany {
  return {
    id: "2",
    name: "ИП САРКУЛИН ДАМИР",
    status: "active",
    has_active_session: true,
    active_cashiers: 1,
    ...overrides,
  };
}

function fakeClient(options: {
  account?: AcquirerAccount;
  companies?: KaspiCompany[] | (() => Promise<KaspiCompany[]>);
  setAcquirerAccount?: (input: { account_ref: string; is_active: boolean }) => Promise<AcquirerAccount>;
} = {}): PaymentAcceptanceClient {
  return {
    getAcquirerAccount: vi.fn(async () => options.account ?? account()),
    listKaspiCompanies: vi.fn(async () =>
      typeof options.companies === "function" ? options.companies() : (options.companies ?? [company()]),
    ),
    setAcquirerAccount: vi.fn(async (_r: string, input) =>
      options.setAcquirerAccount
        ? options.setAcquirerAccount({ account_ref: input.account_ref, is_active: input.is_active })
        : account({ connected: true, account_ref: input.account_ref, is_active: input.is_active }),
    ),
  };
}

function renderCard(client: PaymentAcceptanceClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentAcceptanceCard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("PaymentAcceptanceCard", () => {
  it("сохраняет выбранную компанию и показывает то, что вернул сервер", async () => {
    const client = fakeClient({
      companies: [company(), company({ id: "3", name: "ТОО «Вторая»" })],
    });
    renderCard(client);

    const select = (await screen.findByLabelText(/Компания в Kaspi/)) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(client.setAcquirerAccount).toHaveBeenCalledWith(RESTAURANT_ID, {
        provider: "kaspi",
        account_ref: "3",
        is_active: false,
      }),
    );
    await screen.findByText("Привязка сохранена");
  });

  it("отправляет включённую активность вместе с компанией", async () => {
    const client = fakeClient({ companies: [company()] });
    renderCard(client);

    fireEvent.change(await screen.findByLabelText(/Компания в Kaspi/), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Приём оплаты включён/ }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(client.setAcquirerAccount).toHaveBeenCalledWith(RESTAURANT_ID, {
        provider: "kaspi",
        account_ref: "2",
        is_active: true,
      }),
    );
  });

  it("показывает текущую привязку", async () => {
    const client = fakeClient({
      account: account({ connected: true, account_ref: "2", is_active: true }),
    });
    renderCard(client);

    expect(await screen.findByText(/Сейчас привязано: ИП САРКУЛИН ДАМИР \(ID 2\)/)).toBeTruthy();
    // Ничего не меняли — сохранять нечего.
    expect((screen.getByRole("button", { name: "Сохранить" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("называет компанию без живой сессии кассира", async () => {
    const client = fakeClient({
      account: account({ connected: true, account_ref: "2", is_active: true }),
      companies: [company({ has_active_session: false, active_cashiers: 0 })],
    });
    renderCard(client);

    expect(await screen.findByText("Нет активной сессии кассира")).toBeTruthy();
    expect(screen.getByText(/оплаты не пройдут, пока кассир не войдёт заново/)).toBeTruthy();
  });

  it("недоступный сервис Kaspi: причина словами и запертое сохранение", async () => {
    const client = fakeClient({
      account: account({ connected: true, account_ref: "2", is_active: true }),
      companies: () => Promise.reject(Object.assign(new Error("unavailable"), { status: 503 })),
    });
    renderCard(client);

    expect(await screen.findByText(/Сервис Kaspi не отвечает/)).toBeTruthy();
    // Привязка всё равно видна: это первое, что спросят, когда оплата не идёт.
    expect(screen.getByText(/Сейчас привязано: 2 \(ID 2\)/)).toBeTruthy();
    // Форма заперта целиком: менять привязку вслепую нельзя. (В jsdom
    // disabled у <fieldset> не проецируется на .disabled потомков, поэтому
    // проверяем сам fieldset.)
    const form = (screen.getByLabelText(/Компания в Kaspi/) as HTMLSelectElement).closest("fieldset");
    expect(form?.disabled).toBe(true);
    expect(client.setAcquirerAccount).not.toHaveBeenCalled();
  });

  it("не даёт сохранить пустой выбор", async () => {
    const client = fakeClient({ companies: [company()] });
    renderCard(client);

    // Ничего не выбрано и ничего не менялось — кнопка заперта, запрос не уходит.
    await screen.findByLabelText(/Компания в Kaspi/);
    const save = screen.getByRole("button", { name: "Сохранить" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(client.setAcquirerAccount).not.toHaveBeenCalled();
  });

  it("отказ сервера виден человеку и не стирает выбор", async () => {
    const client = fakeClient({
      companies: [company()],
      setAcquirerAccount: () => Promise.reject(Object.assign(new Error("nope"), { status: 403 })),
    });
    renderCard(client);

    fireEvent.change(await screen.findByLabelText(/Компания в Kaspi/), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Менять привязку может только суперадмин")).toBeTruthy();
    expect((screen.getByLabelText(/Компания в Kaspi/) as HTMLSelectElement).value).toBe("2");
  });
});
