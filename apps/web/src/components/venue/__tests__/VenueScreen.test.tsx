import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { RepositoryError, type Restaurant } from "@bookeat/api/client";

import { pending, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";
import { bookingHref } from "@web/lib/booking-link";

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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("пустое меню убирает весь блок «Меню» со страницы, а не заглушку", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({ menuHighlights: [], photos: [], description: "" }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    // Отсутствие фотографий и описания по-прежнему сказано словами — это
    // работает как раньше и меняться не должно.
    expect(await screen.findByText("Заведение пока не загрузило фотографии.")).toBeTruthy();
    expect(screen.getByText("Заведение пока не рассказало о себе.")).toBeTruthy();
    // А пустое меню — не заглушка, а полное отсутствие секции и вкладки.
    expect(screen.queryByText("Меню пока не заполнено.")).toBeNull();
    expect(screen.queryByRole("link", { name: "Меню" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Популярное в меню" })).toBeNull();
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
   * Осталось то, что график ВСЁ ЕЩЁ решает: ярлык статуса в шапке
   * (3525:14586 «Открыто до 23:00»). Подпись под телефоном (3525:14723) ушла
   * вместе со снятым блоком «Контакты и как добраться» (2026-09-07).
   * Открытость считает сервер (`schedule.openNow`); клиент лишь дописывает к
   * ней время из сегодняшней строки графика.
   */
  it("ярлык в шапке — «Открыто до …» со временем закрытия сегодняшнего дня", async () => {
    // Понедельник, 14:00 по Алматы. Подменяем только Date: таймеры
    // testing-library должны остаться настоящими.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-31T09:00:00Z"));
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        phone: "+7 (707) 547-47-47",
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

    expect(await screen.findByText("Открыто до 01:00")).toBeTruthy();
    expect(screen.queryByText("Открыто сейчас")).toBeNull();
    // Подневного расписания на странице нет — ни в правой колонке, ни где-либо
    // ещё. Если оно снова появится, это должно быть осознанной правкой макета.
    expect(screen.queryByText("12:00–01:00 (до следующего дня)")).toBeNull();
    expect(screen.queryByText("Выходной")).toBeNull();
  });

  it("закрытое заведение получает слова, а не пустой ярлык", async () => {
    // Понедельник, 09:00 по Алматы — до открытия.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-31T04:00:00Z"));
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        schedule: {
          timezone: "Asia/Almaty",
          openNow: false,
          days: [{ dayOfWeek: 1, isOpen: true, opensAt: "12:00", closesAt: "23:00", closesNextDay: false }],
        },
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByText("Откроется в 12:00")).toBeTruthy();
  });

  /**
   * Блок «Контакты и как добраться» (карта + адрес/телефон/соцсети) снят со
   * страницы заведения целиком (2026-09-07): карты без провайдера показывать
   * нечего, а половинчатую секцию решили не оставлять. Проверяем, что даже
   * при полном наборе контактных данных от сервера ни карта, ни адрес, ни
   * телефон, ни ссылки соцсетей на странице не появляются.
   */
  it("контактов и карты на странице заведения больше нет", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        address: "Проспект Аль-Фараби, 128В",
        phone: "+7 (707) 547-47-47",
        latitude: 43.222,
        longitude: 76.851,
        social: {
          instagram: "https://www.instagram.com/tbilisi.almaty/",
          whatsapp: "https://api.whatsapp.com/send/?phone=77055743434",
        },
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    // Ждём, пока страница дорисуется (уникальный заголовок первого уровня),
    // и только потом проверяем отсутствие — иначе `queryBy*` прошёл бы и по
    // ещё не загруженным данным.
    await screen.findByRole("heading", { level: 1 });

    // «Контакты» ссылкой в подвале сайта осталась (ведёт на /contacts) — не
    // трогаем; проверяем только заголовок и содержимое снятого блока.
    expect(screen.queryByText("Контакты и как добраться")).toBeNull();
    expect(screen.queryByText("Проспект Аль-Фараби, 128В")).toBeNull();
    expect(screen.queryByRole("link", { name: "tbilisi.almaty" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: (name) => name.includes("+7 (707) 547-47-47") }),
    ).toBeNull();
    expect(document.getElementById("venue-contacts")).toBeNull();
  });

  /** Правая колонка макета (узел 3525:14730) — РОВНО одна карточка брони. */
  it("в правой колонке стоит карточка брони, а не часы работы", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByRole("heading", { name: "Забронировать столик" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Часы работы" })).toBeNull();
  });

  /** Ниже `lg` карточки нет — прибитая полоса с одной кнопкой, как футер
   * экрана заведения в приложении (`docs/responsive.md`, дыра № 8). Кнопка —
   * ссылка на экран брони без параметров: выбор делается там. */
  it("прибитая полоса ведёт на страницу брони этого заведения", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());

    renderScreen(<VenueScreen id="venue-1" />);

    const link = await screen.findByRole("link", { name: "Забронировать стол" });
    expect(link.getAttribute("href")).toBe(bookingHref("venue-1"));
  });
});

describe("степпер предзаказа на карточке блюда (A1-A4)", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  const dish = {
    id: "dish-1",
    name: "Стейк рибай",
    description: "",
    price: "8 990 ₸",
    priceMinor: 899000,
    isTopPick: false,
  };

  it("у блюда с ценой — контрол; у блюда без цены — нет (A1)", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        menuHighlights: [dish, { ...dish, id: "dish-2", name: "Соус дня", priceMinor: null }],
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    expect(await screen.findByRole("button", { name: "Добавить Стейк рибай" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Добавить Соус дня" })).toBeNull();
  });

  it("«+» превращает кнопку в пилюлю «− 1 +», ещё «+» — «2» (A2-A3)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail({ menuHighlights: [dish] }));

    renderScreen(<VenueScreen id="venue-1" />);

    const add = await screen.findByRole("button", { name: "Добавить Стейк рибай" });
    fireEvent.click(add);

    expect(await screen.findByText("1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Увеличить количество" }));
    expect(await screen.findByText("2")).toBeTruthy();
  });

  it("«−» при 1 убирает строку и возвращает одиночный «+» (A4)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail({ menuHighlights: [dish] }));

    renderScreen(<VenueScreen id="venue-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Добавить Стейк рибай" }));
    await screen.findByText("1");
    fireEvent.click(screen.getByRole("button", { name: "Уменьшить количество" }));

    expect(await screen.findByRole("button", { name: "Добавить Стейк рибай" })).toBeTruthy();
    expect(screen.queryByText("1")).toBeNull();
  });

  it("на потолке 20 «+» помечена aria-disabled и не растёт дальше (A3)", async () => {
    window.sessionStorage.setItem(
      "bookeat.web.preorder-draft.venue-1",
      JSON.stringify({ lines: [{ menuItemId: "dish-1", name: "Стейк рибай", priceMinor: 899000, quantity: 20 }] }),
    );
    repository.getRestaurant = vi.fn(async () => venueDetail({ menuHighlights: [dish] }));

    renderScreen(<VenueScreen id="venue-1" />);

    const more = await screen.findByRole("button", { name: "Увеличить количество" });
    expect(more.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(more);
    expect(await screen.findByText("20")).toBeTruthy();
  });

  it("черновик переживает перезагрузку страницы (A5)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail({ menuHighlights: [dish] }));

    const first = renderScreen(<VenueScreen id="venue-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Добавить Стейк рибай" }));
    await screen.findByText("1");
    first.unmount();

    renderScreen(<VenueScreen id="venue-1" />);
    expect(await screen.findByText("1")).toBeTruthy();
  });

  it("заведение без acceptsOnlineBookings — контрола нет вовсе", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({ menuHighlights: [dish], acceptsOnlineBookings: false }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    await screen.findByText(dish.name);
    expect(screen.queryByRole("button", { name: "Добавить Стейк рибай" })).toBeNull();
  });
});

describe("карточка акции — данные, которые раньше терялись (B1-B6)", () => {
  it("бейдж только при discountPercent > 0, подзаголовок «заведение · условия», обложка вместо заливки", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        name: "Flour Demi",
        promoBanners: [
          {
            id: "promo-1",
            title: "Два стейка за 8 990 ₸",
            coverImageUrl: "https://cdn/promo.jpg",
            discountPercent: 25,
            terms: "будни до 18:00",
            endsAt: "2026-12-31T18:59:59Z",
          },
        ],
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    const link = await screen.findByRole("link", { name: /Два стейка за 8 990 ₸/ });
    expect(link.getAttribute("href")).toBe("/promos/promo-1");
    expect(within(link).getByText("−25%")).toBeTruthy();
    expect(within(link).getByText("Flour Demi · будни до 18:00")).toBeTruthy();
    expect(link.querySelector("img")?.getAttribute("src")).toBe("https://cdn/promo.jpg");
  });

  it("без discountPercent и без terms — нет бейджа, подзаголовок «до {дата}»", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        name: "Flour Demi",
        promoBanners: [
          {
            id: "promo-2",
            title: "Бизнес-ланч",
            coverImageUrl: null,
            discountPercent: null,
            terms: "",
            endsAt: "2026-09-30T18:59:59+05:00",
          },
        ],
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    await screen.findByText("Бизнес-ланч");
    expect(screen.queryByText("−0%")).toBeNull();
    expect(screen.getByText(/Flour Demi · до/)).toBeTruthy();
  });

  it("discountPercent: 0 — бейдж не рисуется (сервер допускает 0..100)", async () => {
    repository.getRestaurant = vi.fn(async () =>
      venueDetail({
        promoBanners: [
          {
            id: "promo-3",
            title: "Скоро",
            coverImageUrl: null,
            discountPercent: 0,
            terms: "",
            endsAt: "2026-09-30T18:59:59Z",
          },
        ],
      }),
    );

    renderScreen(<VenueScreen id="venue-1" />);

    await screen.findByText("Скоро");
    expect(screen.queryByText("−0%")).toBeNull();
  });
});
