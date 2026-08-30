import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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
