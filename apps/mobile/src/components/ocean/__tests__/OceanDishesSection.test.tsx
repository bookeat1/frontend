import type { MenuDish } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { OceanDishesSection } from "../OceanDishesSection";
import type { OceanSignatureDishesState } from "../use-ocean-signature-dishes";

const t = getDictionary("ru");

/**
 * ЧЕТЫРЕ СОСТОЯНИЯ блока «Фирменный улов» и то, ради чего он стал живым.
 *
 * Секция принимает состояние пропом, поэтому проверяется без сети и без
 * провайдера — как «Все точки». Что ловят тесты: название и цена берутся из
 * блюда сервера (не из словаря), тап открывает карточку блюда, блюдо, которого
 * в меню нет, оставляет карточку нейтральной и НЕ кнопкой, ошибка даёт
 * «Повторить», загрузка не рисует ни названия, ни цены.
 */

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

const PLATTER: MenuDish = {
  id: "dish-platter",
  name: "Full Deck Platter",
  description: "Большое плато морепродуктов",
  priceMinor: 3_799_000,
  imageUrl: null,
  isAvailable: true,
};
const PRAWNS: MenuDish = {
  id: "dish-prawns",
  name: "King Креветки 6 шт",
  description: "",
  priceMinor: 1_509_000,
  imageUrl: null,
  isAvailable: false,
};

function renderSection(state: OceanSignatureDishesState) {
  return render(<OceanDishesSection contentPadding={16} state={state} />);
}

const sheet = () => document.body.querySelector<HTMLElement>('[data-testid="dish-card-sheet"]');

describe("блок «Фирменный улов»", () => {
  it("готово: название и цена — из блюда сервера, карточка — кнопка", () => {
    renderSection({ status: "ready", dishes: [PLATTER, PRAWNS] });

    expect(screen.getByText("Full Deck Platter")).toBeTruthy();
    expect(screen.getByText("King Креветки 6 шт")).toBeTruthy();
    expect(
      screen.getAllByText((_, element) => element?.textContent === "15\u00A0090\u00A0₸").length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText(t.oceanBasket.dishOpen("Full Deck Platter"))).toBeTruthy();
    expect(screen.getByLabelText(t.oceanBasket.dishOpen("King Креветки 6 шт"))).toBeTruthy();
  });

  it("тап открывает карточку блюда с серверным описанием и без «Добавить»", () => {
    renderSection({ status: "ready", dishes: [PLATTER, PRAWNS] });
    expect(sheet()).toBeNull();

    fireEvent.click(screen.getByLabelText(t.oceanBasket.dishOpen("Full Deck Platter")));

    expect(sheet()).not.toBeNull();
    expect(sheet()?.textContent).toContain("Большое плато морепродуктов");
    expect(screen.queryByRole("button", { name: /^Добавить/ })).toBeNull();
  });

  it("блюдо из стоп-листа открывается и честно подписано", () => {
    renderSection({ status: "ready", dishes: [PLATTER, PRAWNS] });

    fireEvent.click(screen.getByLabelText(t.oceanBasket.dishOpen("King Креветки 6 шт")));

    expect(sheet()?.textContent).toContain(t.restaurant.menuDishUnavailable);
  });

  it("блюда нет в меню — карточка остаётся нейтральной и не нажимается", () => {
    renderSection({ status: "ready", dishes: [PLATTER, undefined] });

    expect(screen.getByText("Full Deck Platter")).toBeTruthy();
    expect(screen.getByText(t.oceanBasket.dishMissing)).toBeTruthy();
    // Одна кнопка — у найденного блюда; у пропавшего кнопки нет.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("King Креветки 6 шт")).toBeNull();
  });

  it("загрузка: подпись «Загружаем меню…», ни названий, ни кнопок", () => {
    renderSection({ status: "loading" });

    expect(screen.getAllByText(t.oceanBasket.dishesLoading)).toHaveLength(2);
    expect(screen.queryByText("Full Deck Platter")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("ошибка: «Меню не загрузилось» и «Повторить» по нажатию", () => {
    const retry = vi.fn();
    renderSection({ status: "error", retry });

    expect(screen.getAllByText(t.oceanBasket.dishesError)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: t.common.retry })[0]);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("блюдо без цены подписано «Цену уточняйте», но открывается", () => {
    renderSection({ status: "ready", dishes: [{ ...PLATTER, priceMinor: null }, PRAWNS] });

    expect(screen.getAllByText(t.restaurant.menuDishNoPrice).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(t.oceanBasket.dishOpen("Full Deck Platter"))).toBeTruthy();
  });
});
