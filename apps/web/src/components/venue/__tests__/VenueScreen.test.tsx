import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { RepositoryError, type Restaurant } from "@bookeat/api/client";

import { pending, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";

/**
 * Страница заведения. Важнее всего два состояния, которые легко перепутать:
 * «сервер ответил 404 — такого заведения нет» и «связь упала». Гость должен
 * получить разные объяснения: в первом случае повторять бессмысленно.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { VenueScreen } = await import("@web/components/venue/VenueScreen");

describe("карточка заведения", () => {
  it("пока заведение едет, показывает загрузку", async () => {
    repository.getRestaurant = vi.fn(() => pending<Restaurant>());

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("404 — это «заведение не найдено», а не «проверьте соединение»", async () => {
    repository.getRestaurant = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });

    renderScreen(<VenueScreen id="ghost" />);

    expect(await screen.findByText("Заведение не найдено")).toBeTruthy();
    expect(screen.queryByText("Не удалось загрузить")).toBeNull();
  });

  it("сбой связи — это ошибка с повтором", async () => {
    repository.getRestaurant = vi.fn(async () => {
      throw new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true);
    });

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByText("Не удалось загрузить")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("пустое меню и отсутствие фотографий сказаны словами", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({ menuHighlights: [], photos: [], description: "" }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByText("Меню пока не заполнено.")).toBeTruthy();
    expect(screen.getByText("Заведение пока не загрузило фотографии.")).toBeTruthy();
    expect(screen.getByText("Заведение пока не рассказало о себе.")).toBeTruthy();
  });

  it("удобства заведения — ряд ярлыков из ответа сервера, а не выдумка", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        amenities: [
          { id: "terrace", name: "Терраса" },
          { id: "wifi", name: "Wi-Fi" },
        ],
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    const row = await screen.findByRole("list", { name: "Удобства заведения" });
    expect(row.textContent).toContain("Терраса");
    expect(row.textContent).toContain("Wi-Fi");
  });

  it("удобств нет — ряда нет вовсе, а не пустая полоса", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail({ amenities: [] }));

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Удобства заведения" })).toBeNull();
  });

  it("«Все фото» — настоящая кнопка: открывает все снимки", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        photos: [
          { id: "p1", uri: "https://cdn/1.webp", alt: "Зал", width: 1200, height: 800 },
          { id: "p2", uri: "https://cdn/2.webp", alt: "Терраса", width: 1200, height: 800 },
          { id: "p3", uri: "https://cdn/3.webp", alt: "Бар", width: 1200, height: 800 },
        ],
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    const button = await screen.findByRole("button", { name: /Все фото · 3/ });
    fireEvent.click(button);

    const dialog = await screen.findByRole("dialog");
    // Все три снимка, а не только те, что поместились в мозаику.
    expect(dialog.querySelectorAll("img").length).toBe(3);
  });

  it("часы работы берутся из графика сервера, а не выводятся из текста", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        schedule: {
          timezone: "Asia/Almaty",
          openNow: true,
          days: [
            { dayOfWeek: 1, isOpen: true, opensAt: "12:00", closesAt: "01:00", closesNextDay: true },
            { dayOfWeek: 2, isOpen: false, opensAt: null, closesAt: null, closesNextDay: false },
          ],
        },
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByText("12:00–01:00 (до следующего дня)")).toBeTruthy();
    expect(screen.getByText("Выходной")).toBeTruthy();
    expect(screen.getByText("Открыто сейчас")).toBeTruthy();
  });
});
