import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { describe, expect, it, vi } from "vitest";
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
});
