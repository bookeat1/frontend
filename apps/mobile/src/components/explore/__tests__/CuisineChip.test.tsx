import { render, screen } from "@testing-library/react";
import { exploreLayout } from "@bookeat/design-tokens";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * ПОДПИСЬ КУХНИ ПОКАЗЫВАЕТСЯ ЦЕЛИКОМ.
 *
 * Баг 1 (правка владельца 2026-08-24): в кружке кухни стояло «Ср.морская».
 * Сокращения в коде не было — подпись была зажата в одну строку шириной с сам
 * круг (72), и React Native обрезал единственное длинное слово. Данные трогать
 * нельзя: название приходит из каталога (`cuisine_type`).
 *
 * Баг 2 (правка владельца 2026-09-01): «Морепродукты» разорвалось на
 * «Морепродукт / ы». Лечение первого бага дало подписи ДВЕ строки — и этим же
 * разрешило React Native ломать единственное слово посередине: в две строки
 * оно помещается, значит `adjustsFontSizeToFit` сжимать шрифт не обязан.
 *
 * Действующее правило: число строк = число слов, но не больше двух. Одно
 * слово — одна строка: ломать нечего, и шрифт вынужден ужаться. Два и больше
 * — две строки: перенос идёт по пробелу, слова остаются целыми.
 *
 * ЧЕГО ЭТИ ТЕСТЫ НЕ ДОКАЗЫВАЮТ: что подпись реально помещается. Ширину текста
 * меряет платформа, а `adjustsFontSizeToFit` в react-native-web не
 * реализован вовсе — сжатие шрифта проверяется только на устройстве.
 */

// require(jpg/png) Node разобрать не может — подменяется только источник
// картинки, разметка подписи остаётся настоящей.
vi.mock("../cuisine-photos", () => ({ cuisinePhoto: () => undefined }));

const { CuisineChip, cuisineLabelLines } = await import("../CuisineChip");

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

  it("одному слову даёт ОДНУ строку — иначе его ломает посередине", () => {
    render(
      <CuisineChip
        cuisine={{ id: "морепродукты", name: "Морепродукты" }}
        onSelect={vi.fn()}
      />,
    );

    // react-native-web разводит два случая разными свойствами: одна строка —
    // это `white-space: nowrap` (перенос запрещён вовсе, в том числе внутри
    // слова), две и больше — `-webkit-line-clamp`. Проверяем то самое
    // свойство, которое и запрещает разрыв «Морепродукт / ы».
    const label = screen.getByText("Морепродукты");
    const style = getComputedStyle(label);
    expect(style.getPropertyValue("white-space")).toBe("nowrap");
    expect(style.getPropertyValue("-webkit-line-clamp")).toBe("");
  });

  it("составному названию даёт ДВЕ строки — переносить есть по чему", () => {
    render(
      <CuisineChip
        cuisine={{ id: "ближневосточная кухня", name: "Ближневосточная кухня" }}
        onSelect={vi.fn()}
      />,
    );

    const label = screen.getByText("Ближневосточная кухня");
    expect(getComputedStyle(label).getPropertyValue("-webkit-line-clamp")).toBe("2");
  });

  it("правило числа строк держится на боевых названиях всех трёх языков", () => {
    // Одно слово — одна строка.
    expect(cuisineLabelLines("Морепродукты")).toBe(1);
    expect(cuisineLabelLines(LONGEST_LIVE_CUISINE)).toBe(1);
    expect(cuisineLabelLines("Seafood")).toBe(1);
    expect(cuisineLabelLines("Итальянская")).toBe(1);
    // Два и больше — две.
    expect(cuisineLabelLines("Теңіз өнімдері")).toBe(2);
    expect(cuisineLabelLines("Middle Eastern")).toBe(2);
    expect(cuisineLabelLines("Жерорта теңізі асханасы")).toBe(2);
    // Мусор во входных данных не должен давать ноль строк.
    expect(cuisineLabelLines("  Греческая  ")).toBe(1);
    expect(cuisineLabelLines("")).toBe(1);
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
