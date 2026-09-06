import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { RepositoryError } from "@bookeat/api/client";
import type { EventSummary } from "@bookeat/api/client";

import { eventSummary, pending, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";

/**
 * Карточка события /events/[id] (узел 5033:6922): критерии 3–5, 8, 9 T1
 * (`specs/web-fixes-20260906.md`).
 */

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

beforeEach(() => {
  repository.getEvent = vi.fn(async () => eventSummary({ description: "Гриль на террасе." }));
  repository.getRestaurant = vi.fn(async () => venueDetail());
});

describe("EventScreen", () => {
  it("загрузка — статус, без заголовка события", () => {
    repository.getEvent = vi.fn(() => pending<EventSummary>());
    renderScreen(<EventScreen id="evt-1" />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("критерий 3: событие с заведением — мини-карточка, контакты, tel:-ссылка, «Записаться»", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({ phone: "+77771234567", address: "Абая, 10", rating: 4.8, reviewsCount: 12 }),
    );
    renderScreen(<EventScreen id="evt-1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "BBQ-бранч на террасе" })).toBeTruthy();
    expect(screen.getByText("Гриль на террасе.")).toBeTruthy();
    // Мини-карточка заведения — ссылка на страницу заведения.
    expect(await screen.findAllByRole("link", { name: /Открыть страницу заведения/ })).not.toHaveLength(0);
    expect(screen.getByText("★ 4.8")).toBeTruthy();
    // Контакты: телефон — настоящая tel:-ссылка.
    const phoneLink = screen.getByRole("link", { name: /\+77771234567/ });
    expect(phoneLink.getAttribute("href")).toBe("tel:+77771234567");
    // Кнопка «Записаться» ведёт в бронь заведения.
    expect(screen.getByRole("link", { name: "Записаться" }).getAttribute("href")).toContain("/venues/r-1/book");
    expect(screen.getByText("Вход свободный")).toBeTruthy();
  });

  it("критерий 4: событие платформы без кнопки — нет блоков заведения, нет «Записаться»", async () => {
    repository.getEvent = vi.fn(async () =>
      eventSummary({ restaurantId: null, restaurant: null, venue: "", action: null }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderScreen(<EventScreen id="evt-1" />);
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByText("Место проведения")).toBeNull();
    expect(screen.queryByText("Контакты и как добраться")).toBeNull();
    expect(screen.queryByRole("link", { name: "Записаться" })).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("критерий 5: событие платформы с внешней кнопкой — ссылка на action.url в новой вкладке", async () => {
    repository.getEvent = vi.fn(async () =>
      eventSummary({
        restaurantId: null,
        restaurant: null,
        action: { label: "Купить билет", target: "external", url: "https://example.com/tix" },
      }),
    );
    renderScreen(<EventScreen id="evt-1" />);
    const link = await screen.findByRole("link", { name: "Купить билет" });
    expect(link.getAttribute("href")).toBe("https://example.com/tix");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("критерий 5: action.target = event — кнопки нет вовсе", async () => {
    repository.getEvent = vi.fn(async () =>
      eventSummary({
        restaurantId: null,
        restaurant: null,
        action: { label: "Смотреть событие", target: "event", url: null },
      }),
    );
    renderScreen(<EventScreen id="evt-1" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("link", { name: "Смотреть событие" })).toBeNull();
  });

  it("критерий 8: 404 — «Событие не найдено», без повторов, один вызов", async () => {
    const getEvent = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });
    repository.getEvent = getEvent;
    renderScreen(<EventScreen id="missing" />);
    expect(await screen.findByText("Событие не найдено")).toBeTruthy();
    expect(screen.getByRole("link", { name: "К афише" }).getAttribute("href")).toBe("/events");
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
    expect(getEvent).toHaveBeenCalledTimes(1);
  });

  it("ошибка сети — «Повторить»", async () => {
    repository.getEvent = vi.fn(async () => {
      throw new Error("network");
    });
    renderScreen(<EventScreen id="evt-1" />);
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("критерий 9: заведение не загрузилось — страница цела, мини-карточка с именем и ссылкой, без контактов", async () => {
    repository.getRestaurant = vi.fn(async () => {
      throw new Error("network");
    });
    renderScreen(<EventScreen id="evt-1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "BBQ-бранч на террасе" })).toBeTruthy();
    // Имя заведения из самого события — оно есть, даже когда его карточка не загрузилась.
    expect(await screen.findByText("INZHU Terrace")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Открыть страницу заведения/ }).getAttribute("href")).toBe(
      "/venues/r-1",
    );
    expect(screen.queryByText("Контакты и как добраться")).toBeNull();
  });
});
