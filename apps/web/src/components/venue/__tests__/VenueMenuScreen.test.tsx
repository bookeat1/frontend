import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { RepositoryError, type MenuSection } from "@bookeat/api/client";

import { menuDish, pending, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";

/**
 * Страница «Меню {заведение}» (`VenueMenuScreen.tsx`, Figma
 * qmMsg4jO1ggmyEHNIAD2ll, узел 5115:7448) — полный список блюд заведения, а не
 * шесть карточек «Популярное в меню» на странице заведения.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
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
