import { typography } from "@bookeat/design-tokens";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { describe, expect, it, vi } from "vitest";
import { atomicStyle } from "../../../../test/atomic-style";
import type { DishCardItem } from "../../../lib/dish-card";
import { DishDetailSheet } from "../DishDetailSheet";

/**
 * Карточка блюда в режиме «можно добавить» — так она открывается с экрана меню
 * заведения.
 */

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const DISH: DishCardItem = {
  id: "d1",
  name: "Баклажан",
  description: "Печёный, с йогуртом",
  priceLabel: "3\u00a0900\u00a0₸",
  priceMinor: 390000,
  imageUrl: null,
  isAvailable: true,
};

function renderSheet(props: Partial<React.ComponentProps<typeof DishDetailSheet>> = {}) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <DishDetailSheet dish={DISH} canAdd onAdd={onAdd} onClose={onClose} {...props} />
    </SafeAreaProvider>,
  );
  return { ...utils, onAdd, onClose };
}

const addButton = () => screen.getByRole("button", { name: /^Добавить/ });

describe("DishDetailSheet", () => {
  it("счётчик считает итог и отдаёт выбранное количество", () => {
    const { onAdd } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Увеличить количество" }));
    // 3 900 ₸ × 2.
    expect(addButton().getAttribute("aria-label")).toContain("7\u00a0800\u00a0₸");

    fireEvent.click(addButton());
    expect(onAdd).toHaveBeenCalledWith(2);
  });

  it("перерисовка родителя не сбрасывает набранное количество", () => {
    // Экран меню собирает `DishCardItem` на лету, поэтому в шторку каждый раз
    // приезжает НОВЫЙ объект того же блюда. Пока сброс счётчика висел на
    // объекте, «+» откатывался к единице и досчитать до двух было нельзя.
    const { rerender, onAdd } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Увеличить количество" }));

    rerender(
      <SafeAreaProvider initialMetrics={METRICS}>
        <DishDetailSheet dish={{ ...DISH }} canAdd onAdd={onAdd} onClose={() => {}} />
      </SafeAreaProvider>,
    );

    fireEvent.click(addButton());
    expect(onAdd).toHaveBeenCalledWith(2);
  });

  it("счётчик не уходит ниже одной порции", () => {
    const { onAdd } = renderSheet();
    const less = screen.getByRole("button", { name: "Уменьшить количество" });
    fireEvent.click(less);
    fireEvent.click(less);

    fireEvent.click(addButton());
    expect(onAdd).toHaveBeenCalledWith(1);
  });

  it("блюдо без цены читается, но добавить его нельзя", () => {
    renderSheet({
      dish: { ...DISH, priceLabel: null, priceMinor: null },
      canAdd: false,
    });

    expect(document.body.textContent).toContain("Цену уточняйте в ресторане");
    expect(screen.queryByRole("button", { name: /^Добавить/ })).toBeNull();
  });

  it("блюдо из стоп-листа честно подписано", () => {
    renderSheet({ dish: { ...DISH, isAvailable: false }, canAdd: false });
    expect(document.body.textContent).toContain("Сейчас нет в наличии");
  });

  /**
   * ЦЕНА В ШТОРКЕ НАБРАНА ТАК ЖЕ, КАК В МЕНЮ (правка 2026-09-02).
   *
   * Шторка открывается ИЗ строки меню и ИЗ ленты «Популярное в меню», то есть
   * до неё цена меняла вид прямо по тапу: в списке — регулярная 14, внутри —
   * Bold 18 чистым чёрным (`titleCard` + `text.strong`, узла в Figma под этот
   * кегель нет, он был выбран на глаз). Владелец: «везде используется прайс,
   * он должен быть такого же размера как в меню».
   *
   * Стиль читается `atomicStyle`, а не `getComputedStyle`: в jsdom последний
   * врёт про шрифт и цвет (conventions/bookeat-frontend-testing).
   */
  it("цена набрана регулярным 14 и цветом основного текста, как в меню", () => {
    renderSheet();

    const price = screen
      .getAllByText((_content, element) => element?.textContent === DISH.priceLabel)
      .find((element) => element.childElementCount === 0);
    expect(price).toBeTruthy();

    const style = atomicStyle(price as HTMLElement);
    expect(style["font-family"]).toBe(typography.body.fontFamily);
    expect(style["font-size"]).toBe(`${typography.body.fontSize}px`);
    expect(style["color"]).toBe("rgba(27,27,27,1.00)");
  });

  it("название блюда остаётся крупнее цены — иерархия не потеряна", () => {
    renderSheet();

    const name = screen
      .getAllByText((_content, element) => element?.textContent === DISH.name)
      .find((element) => element.childElementCount === 0);
    const price = screen
      .getAllByText((_content, element) => element?.textContent === DISH.priceLabel)
      .find((element) => element.childElementCount === 0);

    const nameStyle = atomicStyle(name as HTMLElement);
    const priceStyle = atomicStyle(price as HTMLElement);
    expect(nameStyle["font-size"]).toBe(`${typography.titleXl.fontSize}px`);
    expect(priceStyle["font-size"]).not.toBe(nameStyle["font-size"]);
  });
});
