import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PaymentMethodsSettings } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentMethodsCard, type PaymentMethodsClient } from "../PaymentMethodsCard";

function setup(initial: PaymentMethodsSettings, put?: PaymentMethodsClient["setPaymentMethods"]) {
  const client: PaymentMethodsClient = {
    getPaymentMethods: vi.fn(async () => initial),
    setPaymentMethods: vi.fn(put ?? (async (_id, input) => ({ ...initial, ...input }))),
  };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PaymentMethodsCard restaurantId="r-1" client={client} />
    </QueryClientProvider>,
  );
  return client;
}

afterEach(cleanup);

describe("PaymentMethodsCard", () => {
  it("Kaspi включён без привязки — подсказка про «Приём оплаты»", async () => {
    setup({ payments_enabled: true, methods: ["kaspi"], kaspi_account_bound: false });
    expect(await screen.findByText(/не привязано|не привязан|байланбаған/)).toBeTruthy();
  });

  it("Kaspi привязан — подсказки нет", async () => {
    setup({ payments_enabled: true, methods: ["kaspi"], kaspi_account_bound: true });
    await screen.findByText("Способы оплаты");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("сохраняет полный список и сохраняет null нетронутого мастер-переключателя", async () => {
    const client = setup({ payments_enabled: null, methods: [], kaspi_account_bound: true });
    fireEvent.click(await screen.findByLabelText(/Карта \(FreedomPay/));
    fireEvent.click(screen.getByLabelText("Kaspi"));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() =>
      expect(client.setPaymentMethods).toHaveBeenCalledWith("r-1", {
        payments_enabled: null,
        methods: ["kaspi", "card"],
      }),
    );
  });

  it("403 — говорит, что менять может только суперадмин, поля не сброшены", async () => {
    setup({ payments_enabled: true, methods: [], kaspi_account_bound: true }, async () => {
      throw Object.assign(new Error("forbidden"), { status: 403 });
    });
    fireEvent.click(await screen.findByLabelText("Kaspi"));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText(/только суперадмин/)).toBeTruthy();
    expect((screen.getByLabelText("Kaspi") as HTMLInputElement).checked).toBe(true);
  });
});
