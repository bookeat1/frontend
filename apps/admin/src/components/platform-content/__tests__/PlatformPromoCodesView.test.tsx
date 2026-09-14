import type { AdminPromo, AdminPromoCode, ApiPage, CreatePromoCodeInput } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Промокоды кампании (марафон Алматы, миграция 0108).
 *
 * Главное, что здесь проверяется: список — суперадмин-only и НЕ paginated
 * (`GET /admin/promo-codes` отдаёт плоский массив, не `Page[T]`); переход
 * статуса шлёт ровно `{status}` через PATCH, а не полную форму; удаление
 * активированного кода показывает объяснение сервера, а не молчит.
 */

const auth = { role: "admin" as string, token: "t" as string | null };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1", role: auth.role }, token: auth.token }),
}));

const { PlatformPromoCodesView } = await import("../PlatformPromoCodesView");

function promoPage(items: AdminPromo[]): ApiPage<AdminPromo> {
  return { items, total: items.length, pages: 1, page: 1, per_page: 100 };
}

function promo(over: Partial<AdminPromo> = {}): AdminPromo {
  return {
    id: "promo-1",
    title: "Марафон Алматы",
    description: "",
    starts_at: "2026-09-01T00:00:00Z",
    ends_at: "2026-10-27T00:00:00Z",
    status: "published",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

function code(over: Partial<AdminPromoCode> = {}): AdminPromoCode {
  return {
    id: "code-1",
    code: "MARATHON26",
    promotion_id: "promo-1",
    starts_at: "2026-09-01T00:00:00Z",
    expires_at: "2026-10-27T00:00:00Z",
    max_uses_total: 100,
    max_uses_per_user: 1,
    status: "draft",
    activations: 0,
    promo_title: "Марафон Алматы",
    promo_status: "published",
    promo_missing: false,
    created_at: "2026-08-20T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
    ...over,
  };
}

function makeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    listPromoCodes: vi.fn(async () => [] as AdminPromoCode[]),
    createPromoCode: vi.fn(async (input: CreatePromoCodeInput) =>
      code({ id: "code-new", code: input.code, promotion_id: input.promotion_id }),
    ),
    patchPromoCode: vi.fn(async (id: string, input: { status?: string }) =>
      code({ id, status: (input.status as AdminPromoCode["status"]) ?? "draft" }),
    ),
    deletePromoCode: vi.fn(async () => undefined),
    listPlatformPromos: vi.fn(async () => promoPage([promo()])),
    ...over,
  };
}

function renderView(client: ReturnType<typeof makeClient>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlatformPromoCodesView client={client} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.role = "admin";
  auth.token = "t";
});

afterEach(cleanup);

describe("промокоды", () => {
  it("не суперадмину раздел не показывают и данные не запрашивают", () => {
    auth.role = "restaurant";
    const client = makeClient();
    renderView(client);

    expect(screen.getByText("Раздел только для администраторов платформы")).toBeTruthy();
    expect(client.listPromoCodes).not.toHaveBeenCalled();
  });

  it("пустой список — приглашение создать первый код", async () => {
    const client = makeClient();
    renderView(client);

    expect(await screen.findByText("Промокодов пока нет")).toBeTruthy();
  });

  it("список показывает код, акцию, статус и использование", async () => {
    const client = makeClient({
      listPromoCodes: vi.fn(async () => [
        code({ status: "active", activations: 3, max_uses_total: 10 }),
      ]),
    });
    renderView(client);

    expect(await screen.findByText("MARATHON26")).toBeTruthy();
    expect(screen.getByText("Марафон Алматы")).toBeTruthy();
    expect(screen.getByText("Активен")).toBeTruthy();
    expect(screen.getByText("3 / 10")).toBeTruthy();
  });

  it("акция скрыта, а код активен — расхождение видно в кабинете", async () => {
    const client = makeClient({
      listPromoCodes: vi.fn(async () => [
        code({ status: "active", promo_status: "hidden" }),
      ]),
    });
    renderView(client);

    expect(await screen.findByText("(акция скрыта)")).toBeTruthy();
  });

  it("создание отправляет выбранную акцию и код без изменений в /admin/promo-codes", async () => {
    const client = makeClient();
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Новый код" }));
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "marathon 26" } });
    // Ждать вызова мока недостаточно — опция появится в DOM только после
    // того, как промис резолвится и компонент перерисуется.
    await screen.findByText("Марафон Алматы");
    fireEvent.change(screen.getByLabelText(/^Акция/), { target: { value: "promo-1" } });
    fireEvent.change(screen.getByLabelText(/^Действует с/), {
      target: { value: "2026-09-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText(/^Действует по/), {
      target: { value: "2026-10-27T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createPromoCode).toHaveBeenCalledTimes(1));
    const input = client.createPromoCode.mock.calls[0]![0] as CreatePromoCodeInput;
    // Нормализацию делает сервер — клиент отправляет то, что ввёл человек.
    expect(input.code).toBe("marathon 26");
    expect(input.promotion_id).toBe("promo-1");
    expect(input.status).toBeUndefined();
    expect(input.max_uses_per_user).toBe(1);
  });

  it("«Активировать сразу» уходит статусом active", async () => {
    const client = makeClient();
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Новый код" }));
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "MARATHON26" } });
    await screen.findByText("Марафон Алматы");
    fireEvent.change(screen.getByLabelText(/^Акция/), { target: { value: "promo-1" } });
    fireEvent.change(screen.getByLabelText(/^Действует с/), {
      target: { value: "2026-09-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText(/^Действует по/), {
      target: { value: "2026-10-27T10:00" },
    });
    fireEvent.click(screen.getByLabelText("Активировать сразу"));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createPromoCode).toHaveBeenCalledTimes(1));
    expect((client.createPromoCode.mock.calls[0]![0] as CreatePromoCodeInput).status).toBe(
      "active",
    );
  });

  it("«Действует по» раньше «Действует с» — форма не отправляется", async () => {
    const client = makeClient();
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Новый код" }));
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "MARATHON26" } });
    await screen.findByText("Марафон Алматы");
    fireEvent.change(screen.getByLabelText(/^Акция/), { target: { value: "promo-1" } });
    fireEvent.change(screen.getByLabelText(/^Действует с/), {
      target: { value: "2026-10-27T10:00" },
    });
    fireEvent.change(screen.getByLabelText(/^Действует по/), {
      target: { value: "2026-09-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe('«Действует по» должно быть позже «Действует с»');
    expect(client.createPromoCode).not.toHaveBeenCalled();
  });

  it("«Активировать» шлёт PATCH только со статусом", async () => {
    const client = makeClient({
      listPromoCodes: vi.fn(async () => [code({ status: "draft" })]),
    });
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Активировать" }));

    await waitFor(() => expect(client.patchPromoCode).toHaveBeenCalledTimes(1));
    expect(client.patchPromoCode).toHaveBeenCalledWith("code-1", { status: "active" });
  });

  it("активный код показывает «Приостановить», не «Активировать»", async () => {
    const client = makeClient({
      listPromoCodes: vi.fn(async () => [code({ status: "active" })]),
    });
    renderView(client);

    expect(await screen.findByRole("button", { name: "Приостановить" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Активировать" })).toBeNull();
  });

  it("архивный код — переходов больше нет, только удаление", async () => {
    const client = makeClient({
      listPromoCodes: vi.fn(async () => [code({ status: "archived" })]),
    });
    renderView(client);

    await screen.findByText("MARATHON26");
    expect(screen.queryByRole("button", { name: "Активировать" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Приостановить" })).toBeNull();
    expect(screen.getByRole("button", { name: "Удалить" })).toBeTruthy();
  });

  it("удаление активированного кода объясняет причину отказа сервера", async () => {
    const { AdminApiError } = await import("@bookeat/api/admin");
    const client = makeClient({
      listPromoCodes: vi.fn(async () => [code({ activations: 2 })]),
      deletePromoCode: vi.fn(async () => {
        throw new AdminApiError("refused", 422, undefined, "promo_code_activated");
      }),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Удалить" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Код уже кто-то использовал — переименовать или удалить нельзя. Приостановите его или переведите в архив",
    );
  });

  it("отмена подтверждения удаления не шлёт запрос", async () => {
    const client = makeClient({ listPromoCodes: vi.fn(async () => [code()]) });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Удалить" }));

    expect(client.deletePromoCode).not.toHaveBeenCalled();
  });
});
