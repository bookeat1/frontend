import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import type { EventPage, EventQuery } from "@bookeat/api/client";

import { eventSummary, pending, renderScreen, repositoryStub } from "@web/test/harness";

/**
 * Страница /events (узел 5033:6703): четыре состояния, чипы из тегов,
 * «Показать ещё» — вторая страница листинга.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/events",
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { EventsScreen } = await import("@web/components/events/EventsScreen");

function page(items: EventPage["items"], pageNo: number, pages: number): EventPage {
  return { items, total: items.length, page: pageNo, pages, perPage: 6 };
}

beforeEach(() => {
  repository.listUpcomingEvents = vi.fn(async () => page([], 1, 0));
});

describe("EventsScreen", () => {
  it("пока запрос летит — скелет и статус загрузки", () => {
    repository.listUpcomingEvents = vi.fn(() => pending<EventPage>());
    renderScreen(<EventsScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Афиша" })).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("пустой ответ — текст пустого состояния, а не пустое место", async () => {
    renderScreen(<EventsScreen />);
    expect(await screen.findByText(/Ближайших событий пока нет/)).toBeTruthy();
  });

  it("ошибка сети — сообщение и кнопка «Повторить», которая перезапрашивает", async () => {
    repository.listUpcomingEvents = vi.fn(async () => {
      throw new Error("network");
    });
    renderScreen(<EventsScreen />);
    const retry = await screen.findByRole("button", { name: "Повторить" });
    fireEvent.click(retry);
    await waitFor(() => expect(repository.listUpcomingEvents).toHaveBeenCalledTimes(2));
  });

  it("карточки ведут на /events/[id], чипы собраны из тегов и фильтруют на клиенте", async () => {
    repository.listUpcomingEvents = vi.fn(async () =>
      page(
        [
          eventSummary({ id: "e1", title: "BBQ-бранч на террасе", tags: ["Живая музыка"] }),
          eventSummary({ id: "e2", title: "Дегустация вин Грузии", tags: ["Дегустация"] }),
        ],
        1,
        1,
      ),
    );
    renderScreen(<EventsScreen />);

    const link = await screen.findByRole("link", { name: "BBQ-бранч на террасе" });
    expect(link.getAttribute("href")).toBe("/events/e1");

    const group = screen.getByRole("group", { name: "Тип события" });
    expect(group.querySelectorAll("button")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Дегустация" }));
    expect(screen.queryByRole("link", { name: "BBQ-бранч на террасе" })).toBeNull();
    expect(screen.getByRole("link", { name: "Дегустация вин Грузии" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Все" }));
    expect(screen.getByRole("link", { name: "BBQ-бранч на террасе" })).toBeTruthy();
    // Показывать ещё нечего — страница одна.
    expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
  });

  it("«Показать ещё» запрашивает следующую страницу с тем же perPage и дописывает карточки", async () => {
    repository.listUpcomingEvents = vi.fn(async (query?: EventQuery) =>
      query?.page === 2
        ? page([eventSummary({ id: "e2", title: "Джаз и коктейли" })], 2, 2)
        : page([eventSummary({ id: "e1", title: "BBQ-бранч на террасе" })], 1, 2),
    );
    renderScreen(<EventsScreen />);

    const more = await screen.findByRole("button", { name: "Показать ещё" });
    fireEvent.click(more);
    expect(await screen.findByRole("link", { name: "Джаз и коктейли" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "BBQ-бранч на террасе" })).toBeTruthy();
    const calls = (repository.listUpcomingEvents as ReturnType<typeof vi.fn>).mock.calls as EventQuery[][];
    expect(calls[calls.length - 1][0]).toMatchObject({ page: 2, perPage: 6 });
    expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
  });
});
