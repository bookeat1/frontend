import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { RepositoryError, type MenuSection } from "@bookeat/api/client";

import { menuDish, pending, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";
import { bookingHref } from "@web/lib/booking-link";
import { formatMoneyMinor } from "@web/lib/format";

/**
 * Страница «Меню {заведение}» (`VenueMenuScreen.tsx`, Figma
 * qmMsg4jO1ggmyEHNIAD2ll, узел 5115:7448) — полный список блюд заведения, а не
 * шесть карточек «Популярное в меню» на странице заведения.
 *
 * СТЕППЕР И КОРЗИНА (ТЗ `web-preorder-menu-20260908`, A-WEB-1..3): тесты этого
 * блока (`степпер...`, `карточка «Предзаказ»...`, `полоса ниже lg...`) сверены
 * с A1-A9.
 */

let search = new URLSearchParams("");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => search,
  usePathname: () => "/venues/venue-1/menu",
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { VenueMenuScreen } = await import("@web/components/venue/VenueMenuScreen");

const SECTIONS: MenuSection[] = [
  {
    title: "Закуски",
    dishes: [
      menuDish({ id: "d1", name: "Тартар из лосося", description: "Лосось, авокадо, цитрусовая заправка" }),
      menuDish({
        id: "d2",
        name: "Карпаччо из говядины",
        description: "Пармезан, руккола, трюфельное масло",
        priceMinor: 610000,
      }),
    ],
  },
  {
    title: "Горячее",
    dishes: [menuDish({ id: "d3", name: "Стейк рибай с овощами", priceMinor: 899000 })],
  },
];

describe("страница «Меню {заведение}»", () => {
  it("пока меню едет, показывает загрузку", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(() => pending<MenuSection[]>());

    renderScreen(<VenueMenuScreen id="venue-1" />);

    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("404 по заведению — «не найдено», а не пустая страница", async () => {
    repository.getRestaurant = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });

    renderScreen(<VenueMenuScreen id="ghost" />);

    expect(await screen.findByText("Заведение не найдено")).toBeTruthy();
  });

  it("пустое меню — слова, а не пустая сетка", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => [] as MenuSection[]);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    expect(await screen.findByText("Меню пока не заполнено.")).toBeTruthy();
  });

  it("заголовок с именем заведения, все блюда всех разделов на сетке, сноска под ней", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail({ name: "Flour Demi" }));
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    expect(await screen.findByRole("heading", { name: "Меню Flour Demi" })).toBeTruthy();
    expect(await screen.findByText("Тартар из лосося")).toBeTruthy();
    expect(screen.getByText("Карпаччо из говядины")).toBeTruthy();
    expect(screen.getByText("Стейк рибай с овощами")).toBeTruthy();
    expect(screen.getByText("5 400 ₸")).toBeTruthy();
    expect(
      screen.getByText("Состав и цены указаны в меню заведения. Об аллергенах уточняйте у официанта."),
    ).toBeTruthy();
  });

  it("чип категории сужает сетку до одного раздела, «Все блюда» возвращает всё", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);
    await screen.findByText("Тартар из лосося");

    fireEvent.click(screen.getByRole("button", { name: "Горячее" }));
    expect(screen.queryByText("Тартар из лосося")).toBeNull();
    expect(screen.getByText("Стейк рибай с овощами")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Все блюда" }));
    expect(screen.getByText("Тартар из лосося")).toBeTruthy();
    expect(screen.getByText("Стейк рибай с овощами")).toBeTruthy();
  });

  it("поиск фильтрует по названию и описанию, раздел без совпадений исчезает", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);
    await screen.findByText("Тартар из лосося");

    fireEvent.change(screen.getByPlaceholderText("Ресторан, кухня или блюдо"), {
      target: { value: "рибай" },
    });

    expect(screen.getByText("Стейк рибай с овощами")).toBeTruthy();
    expect(screen.queryByText("Тартар из лосося")).toBeNull();
    expect(screen.queryByText("Карпаччо из говядины")).toBeNull();
  });

  it("поиск без совпадений — слова «ничего не нашли», а не пустая сетка", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);
    await screen.findByText("Тартар из лосося");

    fireEvent.change(screen.getByPlaceholderText("Ресторан, кухня или блюдо"), {
      target: { value: "пицца" },
    });

    expect(await screen.findByText("Ничего не нашли")).toBeTruthy();
  });

  it("правая колонка — карточка брони, как на странице заведения", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    expect(await screen.findByRole("heading", { name: "Забронировать столик" })).toBeTruthy();
  });
});

describe("степпер предзаказа на карточке блюда (A1-A4)", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    search = new URLSearchParams("");
  });

  it("у доступного блюда с ценой — степпер; без цены — нет (A1)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => [
      {
        title: "Горячее",
        dishes: [
          menuDish({ id: "d1", name: "Стейк рибай", priceMinor: 899000 }),
          menuDish({ id: "d2", name: "Соус дня", priceMinor: null }),
        ],
      },
    ]);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    expect(await screen.findByRole("button", { name: "Добавить Стейк рибай" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Добавить Соус дня" })).toBeNull();
  });

  it("блюдо не в наличии — пометка, степпера нет, у заведения без acceptsOnlineBookings степперов нет нигде (A2)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => [
      {
        title: "Горячее",
        dishes: [menuDish({ id: "d1", name: "Стейк рибай", priceMinor: 899000, isAvailable: false })],
      },
    ]);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    await screen.findByText("Стейк рибай");
    expect(screen.getByText("Сейчас нет в наличии")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Добавить Стейк рибай" })).toBeNull();
  });

  it("заведение без acceptsOnlineBookings — степпера нет даже у доступного блюда", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail({ acceptsOnlineBookings: false }));
    repository.getMenuSections = vi.fn(async () => [
      { title: "Горячее", dishes: [menuDish({ id: "d1", name: "Стейк рибай", priceMinor: 899000 })] },
    ]);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    await screen.findByText("Стейк рибай");
    expect(screen.queryByRole("button", { name: "Добавить Стейк рибай" })).toBeNull();
  });

  it("«+» растит пилюлю, «−» на 1 убирает строку (A3-A4)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => [
      { title: "Горячее", dishes: [menuDish({ id: "d1", name: "Стейк рибай", priceMinor: 899000 })] },
    ]);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Добавить Стейк рибай" }));
    // Непустой черновик рисует ту же строку ЕЩЁ РАЗ в карточке «Предзаказ»
    // справа (A5) — количество и кнопки степпера дублируются, поэтому здесь
    // и ниже берём первое совпадение (карточка блюда идёт в разметке раньше
    // правой колонки, см. `MenuPageBody`).
    expect((await screen.findAllByText("1"))[0]).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Уменьшить количество" })[0]);
    expect(await screen.findByRole("button", { name: "Добавить Стейк рибай" })).toBeTruthy();
  });

  it("черновик переживает смену поиска и категории (A4)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);
    await screen.findByText("Тартар из лосося");

    fireEvent.click(screen.getByRole("button", { name: "Добавить Карпаччо из говядины" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Увеличить количество" })[0]);
    // Непустой черновик держит строку ещё и в карточке «Предзаказ» справа
    // (A5) — «Карпаччо…» видно дважды (сетка + корзина), пока фильтр не
    // спрятал карточку сетки.
    expect(screen.getAllByText("Карпаччо из говядины")).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText("Ресторан, кухня или блюдо"), {
      target: { value: "рибай" },
    });
    // Карточка сетки ушла (не подходит поиску), а строка в корзине справа
    // осталась — поиск/категория черновика не касаются (A4).
    expect(screen.getAllByText("Карпаччо из говядины")).toHaveLength(1);

    fireEvent.change(screen.getByPlaceholderText("Ресторан, кухня или блюдо"), { target: { value: "" } });
    expect(await screen.findAllByText("Карпаччо из говядины")).toHaveLength(2);
  });

  it("черновик общий со страницей заведения — виден без перезагрузки данных (A3)", async () => {
    window.sessionStorage.setItem(
      "bookeat.web.preorder-draft.venue-1",
      JSON.stringify({ lines: [{ menuItemId: "d1", name: "Стейк рибай", priceMinor: 899000, quantity: 2 }] }),
    );
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => [
      { title: "Горячее", dishes: [menuDish({ id: "d1", name: "Стейк рибай", priceMinor: 899000 })] },
    ]);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    expect((await screen.findAllByText("2")).length).toBeGreaterThan(0);
  });
});

describe("карточка «Предзаказ» в правой колонке (A5-A6, A8)", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    search = new URLSearchParams("");
  });

  it("пустой черновик — карточки нет; непустой — строка, «Итого ≈», «Очистить» (A5)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);
    await screen.findByText("Тартар из лосося");

    expect(screen.queryByRole("heading", { name: "Предзаказ" })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Добавить Тартар из лосося" })[0]);

    expect(await screen.findByRole("heading", { name: "Предзаказ" })).toBeTruthy();
    expect(screen.getByText("Итого ≈ 5 400 ₸")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Очистить" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Очистить" }));
    expect(screen.queryByRole("heading", { name: "Предзаказ" })).toBeNull();
  });

  it("строка блюда, ставшего недоступным, помечена «Сейчас нет в наличии» (A6)", async () => {
    window.sessionStorage.setItem(
      "bookeat.web.preorder-draft.venue-1",
      JSON.stringify({ lines: [{ menuItemId: "d1", name: "Стейк рибай", priceMinor: 899000, quantity: 1 }] }),
    );
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => [
      { title: "Горячее", dishes: [menuDish({ id: "d1", name: "Стейк рибай", priceMinor: 899000, isAvailable: false })] },
    ]);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    await screen.findByRole("heading", { name: "Предзаказ" });
    expect(screen.getAllByText("Сейчас нет в наличии").length).toBeGreaterThan(0);
  });

  it("строка блюда, которого в меню больше нет, — без пометки, но удаляемая (A6)", async () => {
    window.sessionStorage.setItem(
      "bookeat.web.preorder-draft.venue-1",
      JSON.stringify({ lines: [{ menuItemId: "ghost", name: "Старое блюдо", priceMinor: 100000, quantity: 1 }] }),
    );
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);

    await screen.findByRole("heading", { name: "Предзаказ" });
    expect(screen.getByText("Старое блюдо")).toBeTruthy();
    expect(screen.queryByText("Сейчас нет в наличии")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Уменьшить количество" }));
    expect(screen.queryByRole("heading", { name: "Предзаказ" })).toBeNull();
  });

  it("без ?date/guests/slot кнопки «Вернуться к бронированию» нет; с ними — есть и ведёт на bookingHref (A8)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    const { unmount } = renderScreen(<VenueMenuScreen id="venue-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Добавить Карпаччо из говядины" }));
    await screen.findByRole("heading", { name: "Предзаказ" });
    expect(screen.queryByRole("link", { name: "Вернуться к бронированию" })).toBeNull();
    unmount();

    search = new URLSearchParams("date=2026-08-25&guests=4&slot=2026-08-25T19%3A30%3A00%2B05%3A00");
    renderScreen(<VenueMenuScreen id="venue-1" />);
    await screen.findByRole("heading", { name: "Предзаказ" });
    const link = screen.getByRole("link", { name: "Вернуться к бронированию" });
    expect(link.getAttribute("href")).toBe(
      bookingHref("venue-1", { date: "2026-08-25", guests: 4, slot: "2026-08-25T19:30:00+05:00" }),
    );
  });
});

describe("полоса ниже lg на странице меню (A7, A9)", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    search = new URLSearchParams("");
  });

  it("пустой черновик — «Забронировать»; непустой — «К бронированию · Итого ≈ N ₸» (A7)", async () => {
    repository.getRestaurant = vi.fn(async () => venueDetail());
    repository.getMenuSections = vi.fn(async () => SECTIONS);

    renderScreen(<VenueMenuScreen id="venue-1" />);
    await screen.findByText("Тартар из лосося");

    const bookLink = screen.getByRole("link", { name: "Забронировать" });
    expect(bookLink.getAttribute("href")).toBe(bookingHref("venue-1", { guests: 2 }));

    fireEvent.click(screen.getAllByRole("button", { name: "Добавить Тартар из лосося" })[0]);
    await screen.findByText("Итого ≈ 5 400 ₸");

    // Имя ссылки по `getByRole` сверяется через собственный алгоритм
    // accessible-name (не тот, что у `getByText`) — он не схлопывает
    // неразрывный пробел `formatMoneyMinor` в обычный, поэтому строим
    // ожидание из той же функции, а не набираем текст вручную.
    const toBookingLink = await screen.findByRole("link", {
      name: `К бронированию · Итого ≈ ${formatMoneyMinor(540000)}`,
    });
    expect(toBookingLink.getAttribute("href")).toBe(bookingHref("venue-1", { guests: 2 }));
  });
});
