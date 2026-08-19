/**
 * Блок «Контакты» — ОДИН на карточку афиши и карточку акции.
 *
 * Тест держит два его обещания: он показывает то, что у заведения реально
 * есть, и исчезает целиком (а не пустым заголовком), когда показывать нечего
 * или заведение ещё не пришло — запрос за ним идёт отдельно от самой
 * афиши/акции и может опоздать.
 */
import { __mockRestaurants, type Restaurant } from "@bookeat/api";
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { RepositoryProvider } from "../../../lib/repository";
import { VenueContactsSection } from "../VenueContactsSection";

const base: Restaurant = __mockRestaurants[0];

const mount = (restaurant: Restaurant | undefined) =>
  render(
    <RepositoryProvider>
      <VenueContactsSection restaurant={restaurant} />
    </RepositoryProvider>,
  );

const section = (container: HTMLElement) => container.querySelector('[data-testid="venue-contacts"]');

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
});
