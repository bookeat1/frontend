/**
 * Блок «Контакты» — ОДИН на карточку афиши и карточку акции.
 *
 * Тест держит два его обещания: он показывает то, что у заведения реально
 * есть, и исчезает целиком (а не пустым заголовком), когда показывать нечего
 * или заведение ещё не пришло — запрос за ним идёт отдельно от самой
 * афиши/акции и может опоздать.
 *
 * Третье обещание, добавленное вместе с общими строками контактов: контакты
 * здесь НАЖИМАЮТСЯ. Раньше это были обычные `View`/`Text` — телефон выглядел
 * как контрол и не звонил.
 */
import { __mockRestaurants, type Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepositoryProvider } from "../../../lib/repository";
import { VenueContactsSection } from "../VenueContactsSection";

// Открытие внешней ссылки подменяется целиком: настоящий `Linking.openURL` в
// jsdom никуда не ведёт, а проверяем мы именно то, ЧТО и с КАКИМ аргументом
// экран просит открыть.
vi.mock("../../../lib/external-links", () => ({
  openPhone: vi.fn(() => Promise.resolve(true)),
  openWhatsApp: vi.fn(() => Promise.resolve(true)),
  openWebsite: vi.fn(() => Promise.resolve(true)),
  openInstagram: vi.fn(() => Promise.resolve(true)),
  openMap: vi.fn(() => Promise.resolve(true)),
}));

import { openMap, openPhone, openWebsite, openWhatsApp } from "../../../lib/external-links";

const t = getDictionary();
const base: Restaurant = __mockRestaurants[0];

const mount = (restaurant: Restaurant | undefined) =>
  render(
    <RepositoryProvider>
      <VenueContactsSection restaurant={restaurant} />
    </RepositoryProvider>,
  );

const section = (container: HTMLElement) => container.querySelector('[data-testid="venue-contacts"]');

/** react-native-web рисует `accessibilityLabel` как `aria-label` — адресуемся
 * к контакту так же, как его видит скринридер. Именно `*ByLabelText`, а не
 * `querySelector('[aria-label=…]')`: селектор с кириллицей в значении атрибута
 * в jsdom не находит существующий элемент. */
const byLabel = (container: HTMLElement, label: string) =>
  within(container).queryByLabelText(label);

const labels = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[aria-label]")).map((el) =>
    el.getAttribute("aria-label"),
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VenueContactsSection", () => {
  it("показывает адрес и телефон заведения", () => {
    const { container } = mount({
      ...base,
      address: "Проспект Аль-Фараби, 77/8, 1 этаж",
      phone: "+7 727 000 00 00",
    });

    expect(section(container)).not.toBeNull();
    expect(container.textContent).toContain("Проспект Аль-Фараби, 77/8, 1 этаж");
    expect(container.textContent).toContain("+7 727 000 00 00");
  });

  it("не рисует ничего, пока заведение не загрузилось", () => {
    const { container } = mount(undefined);
    expect(section(container)).toBeNull();
  });

  it("исчезает целиком, когда у заведения нет контактов", () => {
    const { container } = mount({
      ...base,
      address: "",
      phone: undefined,
      social: undefined,
    });

    expect(section(container)).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("нажатие на телефон открывает звонилку с номером заведения", () => {
    const { container } = mount({ ...base, phone: "+7 727 000 00 00" });

    const row = byLabel(container, `${t.booking.contactPhone}: +7 727 000 00 00`);
    expect(row).not.toBeNull();
    fireEvent.click(row as Element);

    expect(openPhone).toHaveBeenCalledTimes(1);
    expect(openPhone).toHaveBeenCalledWith("+7 727 000 00 00");
  });

  it("нажатие на WhatsApp открывает чат, а на сайт — сайт", () => {
    const { container } = mount({
      ...base,
      social: { whatsapp: "+7 707 111 11 11", website: "bookeat.kz" },
    });

    fireEvent.click(byLabel(container, t.booking.contactWhatsapp) as Element);
    expect(openWhatsApp).toHaveBeenCalledWith("+7 707 111 11 11");

    fireEvent.click(byLabel(container, t.booking.contactWebsite) as Element);
    expect(openWebsite).toHaveBeenCalledWith("bookeat.kz");
  });

  it("у заведения без телефона строки телефона нет и звонить нечему", () => {
    const { container } = mount({
      ...base,
      address: "Проспект Аль-Фараби, 77/8",
      phone: undefined,
    });

    expect(section(container)).not.toBeNull();
    expect(container.textContent).not.toContain(t.restaurant.phoneLabel);
    expect(labels(container).some((label) => label?.startsWith(t.booking.contactPhone))).toBe(
      false,
    );
  });

  it("адрес без координат остаётся текстом, а не кнопкой в никуда", () => {
    const { container } = mount({
      ...base,
      address: "Проспект Аль-Фараби, 77/8",
      latitude: undefined,
      longitude: undefined,
    });

    expect(container.textContent).toContain("Проспект Аль-Фараби, 77/8");
    expect(byLabel(container, `${t.booking.openInMaps}: Проспект Аль-Фараби, 77/8`)).toBeNull();
    expect(openMap).not.toHaveBeenCalled();
  });
});
