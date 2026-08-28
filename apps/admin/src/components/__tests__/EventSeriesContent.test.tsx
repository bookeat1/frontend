import type { AdminEvent, AdminEventRecurrence, ApiPage } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Контент серии — ОДИН на все её даты (migration 0097).
 *
 * Жалоба владельца, ради которой всё это писалось: «Афиша Greek Party — я
 * должен к каждому событию настраивать картинку и текст». Восемнадцать дат —
 * восемнадцать одинаковых правок. Тесты держат четыре вещи:
 *
 *   1. правка контента серии уходит в ПРАВИЛО, а не в отдельную дату;
 *   2. цена этой правки (снятие с главной) видна ДО нажатия «Сохранить»;
 *   3. у отдельной даты видно, какие поля её собственные, а какие наследуются;
 *   4. «вернуть общее» ходит в новую ручку сброса, а не переписывает событие.
 */

const RECURRENCE_ID = "4663361f-0f0a-409b-ba14-4bed16dc9c76";

const updateEvent = vi.fn(async (): Promise<AdminEvent> => events.value[0]!);
const updateEventRecurrence = vi.fn(async () => recurrences.value[0]!);
const resetEventContent = vi.fn(async (): Promise<AdminEvent> => events.value[0]!);

const events: { value: AdminEvent[] } = { value: [] };
const recurrences: { value: AdminEventRecurrence[] } = { value: [] };

const page = <T,>(items: T[]): ApiPage<T> => ({
  items,
  total: items.length,
  pages: 1,
  page: 1,
  per_page: 100,
});

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ restaurant: { id: "r-1", name: "Тестовый" }, user: { id: "u-1" } }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiClient: {
    listEvents: vi.fn(async () => page(events.value)),
    listEventRecurrences: vi.fn(async () => page(recurrences.value)),
    listVenueFeed: vi.fn(async () => page([])),
    updateEvent,
    deleteEvent: vi.fn(),
    updateEventRecurrence,
    resetEventContent,
    activateEventRecurrence: vi.fn(),
    deactivateEventRecurrence: vi.fn(),
    submitRecurrenceToFeed: vi.fn(),
    withdrawRecurrenceFromFeed: vi.fn(),
  },
}));

const { EventsView } = await import("../EventsView");

/** Три пятницы серии. Первая дата ведёт обложку и описание САМА. */
function greekParty(): AdminEvent[] {
  return [
    {
      id: "e-1",
      restaurant_id: "r-1",
      title: "Greek Party",
      description: "Особый вечер именно этой пятницы",
      starts_at: "2026-09-04T20:30:00+05:00",
      ends_at: "2026-09-04T23:30:00+05:00",
      status: "published",
      ticketed: false,
      cover_image_url: "https://cdn/own.jpg",
      recurrence_id: RECURRENCE_ID,
      content_overrides: ["description", "cover_image_url"],
      created_at: "2026-08-01T10:00:00+05:00",
      updated_at: "2026-08-01T10:00:00+05:00",
    },
    {
      id: "e-2",
      restaurant_id: "r-1",
      title: "Greek Party",
      description: "Греческий вечер",
      starts_at: "2026-09-11T20:30:00+05:00",
      ends_at: "2026-09-11T23:30:00+05:00",
      status: "published",
      ticketed: false,
      recurrence_id: RECURRENCE_ID,
      created_at: "2026-08-01T10:00:00+05:00",
      updated_at: "2026-08-01T10:00:00+05:00",
    },
  ];
}

/** Разовое событие: серии у него нет, и ничего про наследование ему писать не
 * надо — оно правится ровно как раньше. */
const oneOff: AdminEvent = {
  id: "s-1",
  restaurant_id: "r-1",
  title: "Вечер джаза",
  description: "",
  starts_at: "2026-09-20T18:00:00+05:00",
  ends_at: "2026-09-20T23:00:00+05:00",
  status: "draft",
  ticketed: false,
  created_at: "2026-08-01T10:00:00+05:00",
  updated_at: "2026-08-01T10:00:00+05:00",
};

const rule: AdminEventRecurrence = {
  id: RECURRENCE_ID,
  restaurant_id: "r-1",
  title: "Greek Party",
  description: "Греческий вечер",
  venue: "летняя терраса",
  cover_image_url: "https://cdn/series.jpg",
  tags: ["живая музыка"],
  occurrence_status: "published",
  ticketed: false,
  tickets_refundable: false,
  ticket_refund_cutoff_minutes: 0,
  frequency: "weekly",
  weekdays: [5],
  start_time: "20:30",
  duration_minutes: 180,
  starts_on: "2026-08-01",
  is_active: true,
  occurrence_feed_status: "approved",
  created_at: "2026-08-01T10:00:00+05:00",
  updated_at: "2026-08-01T10:00:00+05:00",
};

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventsView />
    </QueryClientProvider>,
  );
}

/** Открывает форму правки указанной даты серии. */
async function openDateForm(index: number) {
  fireEvent.click(await screen.findByRole("button", { name: "Показать даты" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Изменить" })[index]!);
  return screen.getByRole("dialog");
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-01T10:00:00+05:00"));
  events.value = greekParty();
  recurrences.value = [rule];
});

afterEach(() => {
  vi.useRealTimers();
  events.value = [];
  recurrences.value = [];
  vi.clearAllMocks();
  cleanup();
});

describe("контент серии правится один раз на все даты", () => {
  it("«Контент серии…» открывает форму с общим контентом правила, а не одной даты", async () => {
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Контент серии…" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Контент серии «Greek Party»/)).toBeTruthy();
    // Значения именно правила: у первой даты и описание, и обложка свои.
    expect((within(dialog).getByDisplayValue("Греческий вечер") as HTMLElement).tagName).toBe(
      "TEXTAREA",
    );
    expect(within(dialog).getByDisplayValue("летняя терраса")).toBeTruthy();
    expect(within(dialog).getByDisplayValue("https://cdn/series.jpg")).toBeTruthy();
  });

  it("сохранение правит ПРАВИЛО целиком и не трогает отдельные даты", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Контент серии…" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByDisplayValue("Греческий вечер"), {
      target: { value: "Греческий вечер каждую пятницу" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(updateEventRecurrence).toHaveBeenCalledTimes(1));
    const [id, input] = updateEventRecurrence.mock.calls[0] as unknown as [
      string,
      { description: string; title: string; frequency: string; start_time: string },
    ];
    expect(id).toBe(RECURRENCE_ID);
    expect(input.description).toBe("Греческий вечер каждую пятницу");
    // PUT правила — полная замена: расписание обязано доехать целиком.
    expect(input.frequency).toBe("weekly");
    expect(input.start_time).toBe("20:30");
    // Ни одна дата отдельно не переписывается — контент разливает сервер.
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("предупреждение о снятии с главной видно ДО нажатия «Сохранить»", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Контент серии…" }));
    const dialog = screen.getByRole("dialog");

    // Ещё ничего не нажато, а последствия уже на экране.
    expect(confirm).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Это изменит все даты серии")).toBeTruthy();
    const warning = within(dialog).getByText(/уйдут с главной/);
    expect(warning.textContent).toContain("всех дат серии");
    expect(warning.textContent).toContain("на одобрение придётся заново");
  });

  it("сохранение без единой правки не пугает последствиями, которых не будет", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Контент серии…" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(updateEventRecurrence).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("отказ в подтверждении не отправляет изменённый контент", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Контент серии…" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByDisplayValue("летняя терраса"), {
      target: { value: "зимний зал" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]![0] as string).toContain("уйдут с главной");
    expect(updateEventRecurrence).not.toHaveBeenCalled();
  });
});

describe("исключения одной даты", () => {
  it("в списке дат исключение видно сразу, до захода в форму", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Показать даты" }));

    // Ровно одна из двух дат ведёт контент сама — и метка стоит только у неё.
    expect(screen.getAllByText("Своё: описание, обложка")).toHaveLength(1);
  });

  it("форма даты показывает, какие поля свои, а какие наследуются от серии", async () => {
    renderView();
    const dialog = await openDateForm(0);

    expect(within(dialog).getByText("Эта дата — часть серии")).toBeTruthy();
    expect(within(dialog).getByText(/Свои поля у этой даты: описание, обложка/)).toBeTruthy();
    // Два своих поля — два маркера, остальные три подписаны как наследуемые.
    expect(within(dialog).getAllByText("Своё у этой даты")).toHaveLength(2);
    expect(within(dialog).getAllByText("Наследуется от серии")).toHaveLength(3);
  });

  it("дата без исключений не притворяется исключением", async () => {
    renderView();
    const dialog = await openDateForm(1);

    expect(within(dialog).queryByText("Своё у этой даты")).toBeNull();
    expect(within(dialog).getAllByText("Наследуется от серии")).toHaveLength(5);
    expect(within(dialog).queryByRole("button", { name: "Вернуть весь контент серии" })).toBeNull();
  });

  it("«Вернуть общее» сбрасывает ОДНО поле через ручку сброса", async () => {
    renderView();
    const dialog = await openDateForm(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Вернуть общее: обложка" }));

    await waitFor(() => expect(resetEventContent).toHaveBeenCalledTimes(1));
    expect(resetEventContent).toHaveBeenCalledWith("e-1", ["cover_image_url"]);
    // Сброс — не сохранение события: полное тело PUT сюда не уходит.
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("«Вернуть весь контент серии» спрашивает и шлёт пустой список полей", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView();
    const dialog = await openDateForm(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Вернуть весь контент серии" }));

    expect(confirm.mock.calls[0]![0] as string).toContain("общий контент серии");
    await waitFor(() => expect(resetEventContent).toHaveBeenCalledWith("e-1", []));
  });

  it("отказ в подтверждении не сбрасывает ничего", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderView();
    const dialog = await openDateForm(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Вернуть весь контент серии" }));

    expect(resetEventContent).not.toHaveBeenCalled();
  });
});

describe("разовое событие правится как раньше", () => {
  it("в его форме нет ни наследования, ни сброса", async () => {
    events.value = [oneOff];
    recurrences.value = [];
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Изменить" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).queryByText("Эта дата — часть серии")).toBeNull();
    expect(within(dialog).queryByText("Наследуется от серии")).toBeNull();
    expect(within(dialog).queryByText("Своё у этой даты")).toBeNull();
    expect(screen.queryByRole("button", { name: "Контент серии…" })).toBeNull();
  });
});
