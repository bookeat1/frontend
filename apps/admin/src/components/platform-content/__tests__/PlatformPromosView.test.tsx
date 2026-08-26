import type { AdminPromo, ApiPage, CityDictionaryEntry, PromoInput } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Акция платформы — акция без заведения (backend PR #103).
 *
 * Главное, что здесь проверяется, — АДРЕС. Создание идёт в
 * `POST /admin/platform/promos`, у которого нет id заведения в пути. Отправка
 * той же формы в `POST /admin/restaurants/:id/promos` завела бы акцию,
 * привязанную к случайному выбранному заведению, и это не «почти то же самое»:
 * гость увидел бы её на карточке чужого ресторана.
 */

const auth = { role: "admin" as string, token: "t" as string | null };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1", role: auth.role }, token: auth.token }),
}));

const dictionary: { value: CityDictionaryEntry[] } = { value: [] };
vi.mock("@/lib/use-cities", () => ({
  useCityDictionary: () => ({ data: dictionary.value, isPending: false, isError: false }),
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

const { PlatformPromosView } = await import("../PlatformPromosView");

function page(items: AdminPromo[]): ApiPage<AdminPromo> {
  return { items, total: items.length, pages: 1, page: 1, per_page: 100 };
}

function promo(over: Partial<AdminPromo> = {}): AdminPromo {
  return {
    id: "p-1",
    title: "Акция платформы",
    description: "",
    starts_at: "2026-09-01T10:00:00+05:00",
    ends_at: "2026-09-30T22:00:00+05:00",
    status: "draft",
    created_at: "2026-08-01T10:00:00+05:00",
    updated_at: "2026-08-01T10:00:00+05:00",
    ...over,
  };
}

function makeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    listPlatformPromos: vi.fn(async () => page([])),
    createPlatformPromo: vi.fn(async (input: PromoInput) =>
      promo({ id: "p-new", title: input.title, status: input.status }),
    ),
    updatePromo: vi.fn(async () => promo()),
    deletePromo: vi.fn(async () => undefined),
    ...over,
  };
}

function renderView(client: ReturnType<typeof makeClient>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlatformPromosView client={client} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.role = "admin";
  auth.token = "t";
  dictionary.value = [
    {
      id: "c-1",
      code: "almaty",
      name: "Алматы",
      value: "Алматы",
      display_order: 1,
      is_active: true,
    },
  ];
});

afterEach(cleanup);

describe("акции платформы", () => {
  it("создание уходит в платформенную ручку, а не в ручку заведения", async () => {
    const client = makeClient();
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Новая акция" }));
    fireEvent.change(screen.getByLabelText(/^Название/), {
      target: { value: "Промокод на первый заказ" },
    });
    fireEvent.change(screen.getByLabelText(/^Действует с/), {
      target: { value: "2026-09-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText(/^Действует по/), {
      target: { value: "2026-09-30T22:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createPlatformPromo).toHaveBeenCalledTimes(1));
    const input = client.createPlatformPromo.mock.calls[0]![0] as PromoInput;
    expect(input.title).toBe("Промокод на первый заказ");
    // Пустой выбор города — осмысленное «во всех городах», и на провод оно
    // уходит как null, а не как пустая строка (её сервер не резолвит).
    expect(input.city).toBeNull();
  });

  it("город из справочника уходит в payload", async () => {
    const client = makeClient();
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Новая акция" }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Только Алматы" } });
    fireEvent.change(screen.getByLabelText(/^Действует с/), {
      target: { value: "2026-09-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText(/^Действует по/), {
      target: { value: "2026-09-30T22:00" },
    });
    fireEvent.change(screen.getByLabelText(/^Город/), { target: { value: "Алматы" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createPlatformPromo).toHaveBeenCalledTimes(1));
    expect((client.createPlatformPromo.mock.calls[0]![0] as PromoInput).city).toBe("Алматы");
  });

  it("в списке нет заведения — его у такой акции не бывает; вместо него город", async () => {
    const client = makeClient({
      listPlatformPromos: vi.fn(async () =>
        page([promo({ title: "Общая акция" }), promo({ id: "p-2", title: "Только Астана", city: "Астана" })]),
      ),
    });
    renderView(client);

    expect(await screen.findByText("Общая акция")).toBeTruthy();
    expect(screen.getByText("Только Астана")).toBeTruthy();
    expect(screen.getByText("Все города")).toBeTruthy();
    expect(screen.getByText("Астана")).toBeTruthy();
  });

  it("не суперадмину раздел не показывают и данные не запрашивают", () => {
    auth.role = "restaurant";
    const client = makeClient();
    renderView(client);

    expect(screen.getByText("Раздел только для администраторов платформы")).toBeTruthy();
    expect(client.listPlatformPromos).not.toHaveBeenCalled();
  });

  it("отказ сервера объясняют по-русски и ввод не выбрасывают", async () => {
    const { RepositoryError } = await import("@bookeat/api");
    const client = makeClient({
      createPlatformPromo: vi.fn(async () => {
        throw new RepositoryError("validation failed", undefined, 422);
      }),
    });
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Новая акция" }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Черновик" } });
    fireEvent.change(screen.getByLabelText(/^Действует с/), {
      target: { value: "2026-09-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText(/^Действует по/), {
      target: { value: "2026-09-30T22:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Сервер отклонил запись — проверьте поля");
    expect(screen.getByLabelText<HTMLInputElement>(/^Название/).value).toBe("Черновик");
  });
});
