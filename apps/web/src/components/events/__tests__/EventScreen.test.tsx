import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";

import type { EventPage } from "@bookeat/api/client";

import { eventSummary, pending, renderScreen, repositoryStub } from "@web/test/harness";

/** Карточка события /events/[id] (узел 5033:6922): найдено, не найдено, загрузка, ошибка. */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/events/evt-1",
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { EventScreen } = await import("@web/components/events/EventScreen");

function page(items: EventPage["items"]): EventPage {
  return { items, total: items.length, page: 1, pages: 1, perPage: 100 };
}

beforeEach(() => {
  repository.listUpcomingEvents = vi.fn(async () => page([eventSummary({ description: "Гриль на террасе." })]));
});

describe("EventScreen", () => {
  it("загрузка — статус, без заголовка события", () => {
    repository.listUpcomingEvents = vi.fn(() => pending<EventPage>());
    renderScreen(<EventScreen id="evt-1" />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("событие найдено: заголовок, заведение, описание, кнопка брони ведёт в поток заведения", async () => {
    renderScreen(<EventScreen id="evt-1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "BBQ-бранч на террасе" })).toBeTruthy();
    expect(screen.getByText("Гриль на террасе.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Записаться" }).getAttribute("href")).toBe("/venues/r-1/book");
    expect(screen.getByRole("link", { name: "Страница заведения" }).getAttribute("href")).toBe("/venues/r-1");
    // Хлебные крошки ведут назад в афишу.
    const crumbs = screen.getByRole("navigation", { name: "Навигация" });
    expect(within(crumbs).getByRole("link", { name: "Афиша" }).getAttribute("href")).toBe("/events");
    // Билетов нет — «Вход свободный».
    expect(screen.getByText("Вход свободный")).toBeTruthy();
  });

  it("билет: цена в тенге из минорных единиц", async () => {
    repository.listUpcomingEvents = vi.fn(async () =>
      page([eventSummary({ ticketed: true, ticketPriceMinor: 1_500_000, ticketsRefundable: false })]),
    );
    renderScreen(<EventScreen id="evt-1" />);
    expect(await screen.findByText("15 000 ₸")).toBeTruthy();
    expect(screen.getByText("Билет не возвращается")).toBeTruthy();
  });

  it("id нет в листинге — «Событие не найдено» и ссылка «К афише», а не «Повторить»", async () => {
    renderScreen(<EventScreen id="missing" />);
    expect(await screen.findByText("Событие не найдено")).toBeTruthy();
    expect(screen.getByRole("link", { name: "К афише" }).getAttribute("href")).toBe("/events");
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
  });

  it("ошибка сети — «Повторить»", async () => {
    repository.listUpcomingEvents = vi.fn(async () => {
      throw new Error("network");
    });
    renderScreen(<EventScreen id="evt-1" />);
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});
