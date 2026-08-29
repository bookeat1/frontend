import type { AdminEvent, ApiPage, CityDictionaryEntry, EventInput } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Событие платформы — событие без заведения (backend PR #103).
 *
 * Два инварианта бэкенда, которые обязаны быть видны в форме:
 *   • БИЛЕТОВ НЕТ. `validateEvent` отвергает `ticketed: true` у события без
 *     заведения, и то же самое стоит CHECK-ом в БД. Предлагать флажок значит
 *     обещать то, чего не будет.
 *   • ЦЕЛЬ КНОПКИ ВЫВОДИТСЯ ИЗ `url`. Поля `target` в запросе нет вовсе, так
 *     что «кнопка ведёт на страницу события» на проводе выглядит как
 *     ОТСУТСТВИЕ url — не как пустая строка.
 */

const auth = { role: "admin" as string };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1", role: auth.role }, token: "t" }),
}));

const dictionary: { value: CityDictionaryEntry[] } = { value: [] };
vi.mock("@/lib/use-cities", () => ({
  useCityDictionary: () => ({ data: dictionary.value, isPending: false, isError: false }),
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

const { PlatformEventsView } = await import("../PlatformEventsView");

function page(items: AdminEvent[]): ApiPage<AdminEvent> {
  return { items, total: items.length, pages: 1, page: 1, per_page: 100 };
}

function event(over: Partial<AdminEvent> = {}): AdminEvent {
  return {
    id: "e-1",
    title: "Гастрофестиваль",
    description: "",
    starts_at: "2026-09-01T18:00:00+05:00",
    ends_at: "2026-09-01T23:00:00+05:00",
    status: "draft",
    ticketed: false,
    created_at: "2026-08-01T10:00:00+05:00",
    updated_at: "2026-08-01T10:00:00+05:00",
    ...over,
  };
}

function makeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    listPlatformEvents: vi.fn(async () => page([])),
    createPlatformEvent: vi.fn(async (input: EventInput) =>
      event({ id: "e-new", title: input.title, status: input.status }),
    ),
    updateEvent: vi.fn(async () => event()),
    deleteEvent: vi.fn(async () => undefined),
    ...over,
  };
}

function renderView(client: ReturnType<typeof makeClient>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlatformEventsView client={client} />
    </QueryClientProvider>,
  );
}

/** Открыть форму создания и заполнить обязательный минимум. */
async function openForm() {
  fireEvent.click(await screen.findByRole("button", { name: "Новое событие" }));
  fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Фестиваль" } });
  fireEvent.change(screen.getByLabelText(/^Начало/), { target: { value: "2026-09-01T18:00" } });
  fireEvent.change(screen.getByLabelText(/^Окончание/), { target: { value: "2026-09-01T23:00" } });
}

beforeEach(() => {
  auth.role = "admin";
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

describe("афиша платформы", () => {
  it("продажу билетов включить нельзя, и сказано почему", async () => {
    const client = makeClient();
    renderView(client);
    await openForm();

    const ticketed = screen.getByLabelText<HTMLInputElement>(/Продажа билетов/);
    expect(ticketed.disabled).toBe(true);
    expect(ticketed.checked).toBe(false);
    expect(screen.getByText(/билеты продавать нельзя/i)).toBeTruthy();
    // Полей билета нет вовсе — обещать цену и вместимость нечем.
    expect(screen.queryByLabelText(/Цена билета/)).toBeNull();
    expect(screen.queryByLabelText(/Вместимость/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(client.createPlatformEvent).toHaveBeenCalledTimes(1));
    const input = client.createPlatformEvent.mock.calls[0]![0] as EventInput;
    expect(input.ticketed).toBe(false);
    expect(input.ticket_price_minor).toBeNull();
    expect(input.capacity).toBeNull();
  });

  it("создание уходит в платформенную ручку", async () => {
    const client = makeClient();
    renderView(client);
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createPlatformEvent).toHaveBeenCalledTimes(1));
    expect((client.createPlatformEvent.mock.calls[0]![0] as EventInput).title).toBe("Фестиваль");
  });

  it("«кнопки нет» — это отсутствие кнопки, а не пустая подпись", async () => {
    const client = makeClient();
    renderView(client);
    await openForm();

    // Поля подписи и ссылки не показываются, пока кнопка не выбрана.
    expect(screen.queryByLabelText(/Подпись кнопки/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createPlatformEvent).toHaveBeenCalledTimes(1));
    expect((client.createPlatformEvent.mock.calls[0]![0] as EventInput).action).toBeNull();
  });

  it("«открывает страницу события» отправляет подпись БЕЗ url", async () => {
    const client = makeClient();
    renderView(client);
    await openForm();

    fireEvent.change(screen.getByLabelText(/Что делает кнопка/), { target: { value: "event" } });
    // `selector` обязателен: у поля с переводами доступное имя есть и у самого
    // ввода, и у полосы вкладок языка («Язык поля «Подпись кнопки»»).
    fireEvent.change(screen.getByLabelText(/Подпись кнопки/, { selector: "input" }), {
      target: { value: "Подробнее" },
    });
    // Поле ссылки в этом режиме даже не рисуется — интерпретировать нечего.
    expect(screen.queryByLabelText(/^Ссылка/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createPlatformEvent).toHaveBeenCalledTimes(1));
    expect((client.createPlatformEvent.mock.calls[0]![0] as EventInput).action).toEqual({
      label: "Подробнее",
      url: null,
    });
  });

  it("внешняя ссылка проверяется до отправки и называет причину", async () => {
    const client = makeClient();
    renderView(client);
    await openForm();

    fireEvent.change(screen.getByLabelText(/Что делает кнопка/), { target: { value: "external" } });
    fireEvent.change(screen.getByLabelText(/Подпись кнопки/, { selector: "input" }), {
      target: { value: "Купить билет" },
    });
    fireEvent.change(screen.getByLabelText(/^Ссылка/), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Ссылка должна начинаться с http:// или https://",
    );
    expect(client.createPlatformEvent).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Ссылка/), {
      target: { value: "https://ticketon.kz/e/1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createPlatformEvent).toHaveBeenCalledTimes(1));
    expect((client.createPlatformEvent.mock.calls[0]![0] as EventInput).action).toEqual({
      label: "Купить билет",
      url: "https://ticketon.kz/e/1",
    });
  });

  it("публикация из списка не стирает город и кнопку — PUT заменяет запись целиком", async () => {
    const existing = event({
      city: "Алматы",
      images: ["https://cdn/1.jpg"],
      action: { label: "Купить билет", target: "external", url: "https://ticketon.kz/e/1" },
    });
    const client = makeClient({ listPlatformEvents: vi.fn(async () => page([existing])) });
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Опубликовать" }));
    await waitFor(() => expect(client.updateEvent).toHaveBeenCalledTimes(1));
    const [, input] = client.updateEvent.mock.calls[0] as unknown as [string, EventInput];
    expect(input.status).toBe("published");
    expect(input.city).toBe("Алматы");
    expect(input.images).toEqual(["https://cdn/1.jpg"]);
    expect(input.action).toEqual({ label: "Купить билет", url: "https://ticketon.kz/e/1" });
  });

  it("не суперадмину раздел не показывают и данные не запрашивают", () => {
    auth.role = "restaurant";
    const client = makeClient();
    renderView(client);

    expect(screen.getByText("Раздел только для администраторов платформы")).toBeTruthy();
    expect(client.listPlatformEvents).not.toHaveBeenCalled();
  });
});
