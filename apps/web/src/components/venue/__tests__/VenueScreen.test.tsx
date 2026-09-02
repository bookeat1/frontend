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
  // Кнопка «Сохранить» строит адрес возврата из текущего пути.
  usePathname: () => "/venues/venue-1",
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

  it("«Сохранить» не притворяется: гостя без входа ведёт на вход", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());

    renderScreen(<VenueScreen id="venue-1" />);

    const save = await screen.findByRole("link", { name: "Сохранить" });
    // Ссылка ПОМНИТ страницу заведения: без этого гость вводит код и попадает
    // на главную, а заведение, ради которого он входил, остаётся позади.
    expect(save.getAttribute("href")).toBe("/login?next=%2Fvenues%2Fvenue-1");
    // И избранное у неавторизованного НЕ запрашивается: ручка требует сессию.
    expect(repository.getFavorites).not.toHaveBeenCalled();
  });

  it("вкладки ведут к секциям страницы, а «Отзывов» среди них нет", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        photos: [{ id: "p1", uri: "https://cdn/1.webp", alt: "Зал", width: 1200, height: 800 }],
        menuHighlights: [
          {
            id: "d1",
            name: "Тартар",
            description: "",
            price: "5 400 ₸",
            priceMinor: 540000,
            isTopPick: false,
          },
        ],
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    const tabs = await screen.findByRole("navigation", { name: "Разделы страницы" });
    expect(tabs.textContent).toContain("Обзор");
    expect(tabs.textContent).toContain("Фото · 1");
    // Отзывов на сайте нет ни секцией, ни страницей — значит и вкладки нет.
    expect(tabs.textContent).not.toContain("Отзыв");
    expect(screen.getByRole("link", { name: "Меню" }).getAttribute("href")).toBe("#venue-menu");
    expect(document.getElementById("venue-menu")).toBeTruthy();

    // «Фото» — не якорь: мозаика стоит выше вкладок, поэтому вкладка открывает
    // окно со всеми снимками, как и кнопка на самой мозаике.
    fireEvent.click(screen.getByRole("button", { name: "Фото · 1" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  /**
   * Отдельного блока часов работы на странице БОЛЬШЕ НЕТ: в макете
   * (QovvuAoI9YxsLMwWkfgKN8, кадр 3525:14561) его нет нигде, а место в правой
   * колонке, которое он занимал «взаймы», заняла карточка брони. Проверка
   * подневного графика ушла вместе с блоком — она проверяла бы вёрстку,
   * которой не существует.
   *
   * Осталось то, что график ВСЁ ЕЩЁ решает: ярлык статуса в шапке. Его считает
   * сервер (`schedule.openNow`), и это единственное, что сегодня на сайте
   * говорит о времени работы.
   */
  it("статус в шапке берётся из графика сервера, а не выводится из текста", async () => {
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

    expect(await screen.findByText("Открыто сейчас")).toBeTruthy();
    // Подневного расписания на странице нет — ни в правой колонке, ни где-либо
    // ещё. Если оно снова появится, это должно быть осознанной правкой макета.
    expect(screen.queryByText("12:00–01:00 (до следующего дня)")).toBeNull();
    expect(screen.queryByText("Выходной")).toBeNull();
  });

  /** Правая колонка макета (узел 3525:14730) — РОВНО одна карточка брони. */
  it("в правой колонке стоит карточка брони, а не часы работы", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByRole("heading", { name: "Забронировать столик" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Часы работы" })).toBeNull();
  });
});
