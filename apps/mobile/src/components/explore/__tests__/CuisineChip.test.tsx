import { render, screen } from "@testing-library/react";
import { exploreLayout } from "@bookeat/design-tokens";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * ПОДПИСЬ КУХНИ ПОКАЗЫВАЕТСЯ ЦЕЛИКОМ.
 *
 * Баг (правка владельца 2026-08-24): в кружке кухни стояло «Ср.морская».
 * Сокращения в коде не было — подпись была зажата в одну строку шириной с сам
 * круг (72), и React Native обрезал единственное длинное слово. Данные трогать
 * нельзя: название приходит из каталога (`cuisine_type`).
 *
 * Лечение — место под текст, а не короткое слово: ячейка шире круга, две
 * строки и сжатие шрифта в пределах токенов.
 */

// require(jpg/png) Node разобрать не может — подменяется только источник
// картинки, разметка подписи остаётся настоящей.
vi.mock("../cuisine-photos", () => ({ cuisinePhoto: () => undefined }));

const { CuisineChip } = await import("../CuisineChip");

const LONGEST_LIVE_CUISINE = "Средиземноморская";

describe("подпись под кружком кухни", () => {
  it("рисует полное название, а не его обрезок", () => {
    render(
      <CuisineChip
        cuisine={{ id: "средиземноморская", name: LONGEST_LIVE_CUISINE }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText(LONGEST_LIVE_CUISINE)).toBeTruthy();
    // Тот самый обрезок, ради которого правка и делалась.
    expect(screen.queryByText("Ср.морская")).toBeNull();
  });

  it("даёт подписи ДВЕ строки, а не одну", () => {
    render(
      <CuisineChip
        cuisine={{ id: "средиземноморская", name: LONGEST_LIVE_CUISINE }}
        onSelect={vi.fn()}
      />,
    );

    // react-native-web переносит numberOfLines в -webkit-line-clamp: одна
    // строка — это ровно то состояние, в котором название и обрезалось.
    const label = screen.getByText(LONGEST_LIVE_CUISINE);
    expect(getComputedStyle(label).getPropertyValue("-webkit-line-clamp")).toBe("2");
  });

  it("держит подпись не уже ячейки макета — иначе длинному слову негде поместиться", () => {
    // Раньше здесь стояло «подпись шире круга»: круг был 72, снятые с
    // отрендеренного экрана, а подпись 96. С 2026-08-26 круг тоже 96 — размер
    // из макета, — поэтому «шире» перестало выполняться, хотя места под
    // подпись ровно столько же. Проверяем то, что и защищали: 96 точек под
    // «Средиземноморская».
    expect(exploreLayout.cuisineChipLabel).toBe(96);
    expect(exploreLayout.cuisineChipLabel).toBeGreaterThanOrEqual(exploreLayout.cuisineChip);
  });

  it("остаётся кнопкой с названием кухни для скринридера", () => {
    const onSelect = vi.fn();
    render(
      <CuisineChip
        cuisine={{ id: "греческая", name: "Греческая" }}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("button", { name: /Греческая/ })).toBeTruthy();
  });
});
