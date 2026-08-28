import type { AdminEvent, AdminEventRecurrence, ApiPage } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Разведение действий «эта дата» и «вся серия».
 *
 * Баг, из-за которого всё это писалось: «Greek Party» — 18 строк в `events` с
 * одним `recurrence_id`, кабинет рисовал 18 одинаковых карточек, и красная
 * «Удалить» на каждой убирала РОВНО ОДНУ дату, выглядя при этом как удаление
 * события целиком. Тесты ниже держат три вещи:
 *
 *   1. серия — одна карточка, а не восемнадцать;
 *   2. «Отменить дату» удаляет ровно одно событие и не трогает правило;
 *   3. серию нельзя снести одним нажатием, а в диалоге остановки по умолчанию
 *      выбран вариант, который НЕ удаляет ни одной даты.
 */

const RECURRENCE_ID = "4663361f-0f0a-409b-ba14-4bed16dc9c76";

const deleteEvent = vi.fn(async () => undefined);
const deactivateEventRecurrence = vi.fn(async () => undefined);
const updateEvent = vi.fn(async (): Promise<AdminEvent> => events.value[0]!);
const updateEventRecurrence = vi.fn(async () => recurrences.value[0]!);

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
    deleteEvent,
    updateEventRecurrence,
    deactivateEventRecurrence,
    activateEventRecurrence: vi.fn(),
    submitRecurrenceToFeed: vi.fn(),
    withdrawRecurrenceFromFeed: vi.fn(),
  },
}));

const { EventsView } = await import("../EventsView");

/** 18 пятниц «Greek Party», все в будущем относительно фиксированного «сейчас». */
function greekParty(): AdminEvent[] {
  return Array.from({ length: 18 }, (_, i) => {
    const day = String(i + 4).padStart(2, "0");
    return {
      id: `e-${i + 1}`,
      restaurant_id: "r-1",
      title: "Greek Party",
      description: "",
      starts_at: `2026-09-${day}T20:30:00+05:00`,
      ends_at: `2026-09-${day}T23:30:00+05:00`,
      status: "published",
      ticketed: false,
      recurrence_id: RECURRENCE_ID,
      created_at: "2026-08-01T10:00:00+05:00",
      updated_at: "2026-08-01T10:00:00+05:00",
    } satisfies AdminEvent;
  });
}

const rule: AdminEventRecurrence = {
  id: RECURRENCE_ID,
  restaurant_id: "r-1",
  title: "Greek Party",
  description: "",
  tags: [],
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
  occurrence_feed_status: "not_submitted",
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

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Раньше первой пятницы серии: все 18 дат — будущие.
  vi.setSystemTime(new Date("2026-09-01T10:00:00+05:00"));
  events.value = greekParty();
  recurrences.value = [rule];
});

afterEach(() => {
  vi.useRealTimers();
  events.value = [];
  recurrences.value = [];
  cleanup();
});

describe("список событий: серия — одна карточка", () => {
  it("восемнадцать дат «Greek Party» показываются одной карточкой с правилом и ближайшей датой", async () => {
    renderView();

    expect(await screen.findByText("Greek Party")).toBeTruthy();
    // Ровно одно упоминание названия — карточка серии, а не 18 карточек.
    expect(screen.getAllByText("Greek Party")).toHaveLength(1);
    expect(screen.getByText("Серия")).toBeTruthy();
    expect(screen.getByText("по пятницам, 20:30")).toBeTruthy();
    expect(screen.getByText(/Ближайшая дата/)).toBeTruthy();
    expect(screen.getByText(/18 дат/)).toBeTruthy();
  });

  it("даты серии скрыты, пока карточку не развернули", async () => {
    renderView();
    const toggle = await screen.findByRole("button", { name: "Показать даты" });
    expect(screen.queryByText("Даты серии")).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByText("Даты серии")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Отменить дату" })).toHaveLength(18);
  });
});

describe("«эта дата» и «вся серия» — разные действия", () => {
  it("в карточке серии нет кнопки «Удалить»: удалить одним нажатием нечего", async () => {
    renderView();
    await screen.findByText("Greek Party");
    expect(screen.queryByRole("button", { name: "Удалить" })).toBeNull();
  });

  it("«Отменить дату» предупреждает, сколько дат останется, и удаляет РОВНО одну", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Показать даты" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Отменить дату" })[0]!);

    const asked = confirm.mock.calls[0]![0] as string;
    expect(asked).toContain("только одну дату");
    expect(asked).toContain("Остальные 17 дат");
    expect(asked).toContain("Greek Party");

    await waitFor(() => expect(deleteEvent).toHaveBeenCalledTimes(1));
    expect(deleteEvent).toHaveBeenCalledWith("e-1");
    // Правило не тронуто: серия продолжает жить.
    expect(deactivateEventRecurrence).not.toHaveBeenCalled();
    expect(updateEventRecurrence).not.toHaveBeenCalled();
  });

  it("отказ в подтверждении не удаляет ничего", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Показать даты" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Отменить дату" })[0]!);

    expect(deleteEvent).not.toHaveBeenCalled();
  });
});

describe("остановка серии", () => {
  it("«Остановить серию…» открывает диалог, а не выполняет действие сразу", async () => {
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Остановить серию…" }));

    expect(screen.getByText("Остановить серию «Greek Party»")).toBeTruthy();
    expect(deactivateEventRecurrence).not.toHaveBeenCalled();
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("по умолчанию выбран безобидный вариант: повтор выключается, ни одна дата не удаляется", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Остановить серию…" }));

    const dialog = screen.getByRole("dialog");
    const [onlyRule, andDates] = within(dialog).getAllByRole("radio") as HTMLInputElement[];
    expect(onlyRule!.checked).toBe(true);
    expect(andDates!.checked).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Остановить серию" }));

    await waitFor(() => expect(deactivateEventRecurrence).toHaveBeenCalledWith(RECURRENCE_ID));
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("второй вариант выбирается явно и только тогда отменяет все будущие даты", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Остановить серию…" }));

    const dialog = screen.getByRole("dialog");
    const radios = within(dialog).getAllByRole("radio") as HTMLInputElement[];
    fireEvent.click(radios[1]!);
    fireEvent.click(within(dialog).getByRole("button", { name: "Остановить серию" }));

    await waitFor(() => expect(deleteEvent).toHaveBeenCalledTimes(18));
    expect(deactivateEventRecurrence).toHaveBeenCalledWith(RECURRENCE_ID);
  });
});

describe("скрытие серии", () => {
  it("«Скрыть всю серию» правит и правило, и все будущие даты", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Скрыть всю серию" }));

    await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(18));
    expect(updateEventRecurrence).toHaveBeenCalledTimes(1);
    const [, ruleInput] = updateEventRecurrence.mock.calls[0] as unknown as [
      string,
      { occurrence_status: string; frequency: string; start_time: string },
    ];
    // Новые даты серии тоже должны рождаться скрытыми, иначе «скрыл» —
    // временно.
    expect(ruleInput.occurrence_status).toBe("hidden");
    // PUT правила — полная замена: расписание обязано доехать целиком.
    expect(ruleInput.frequency).toBe("weekly");
    expect(ruleInput.start_time).toBe("20:30");
    const [, eventInput] = updateEvent.mock.calls[0] as unknown as [string, { status: string }];
    expect(eventInput.status).toBe("hidden");
  });
});

describe("модерация главной у серии", () => {
  it("заявка на главную одна на серию, у отдельных дат такой кнопки нет", async () => {
    renderView();
    await screen.findByText("Greek Party");

    expect(screen.getAllByRole("button", { name: "Отправить на главную" })).toHaveLength(1);
    expect(screen.getByText(/На главную отправляется ВСЯ серия/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Показать даты" }));
    // Развернули 18 дат — заявка всё та же одна.
    expect(screen.getAllByRole("button", { name: "Отправить на главную" })).toHaveLength(1);
  });
});
