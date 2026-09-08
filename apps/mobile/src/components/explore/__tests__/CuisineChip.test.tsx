import { render, screen } from "@testing-library/react";
import { exploreLayout, typography } from "@bookeat/design-tokens";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * ПОДПИСЬ КУХНИ: ОДИН КЕГЛЬ У ВСЕХ, ЦЕЛИКОМ, ПЕРЕНОС ТОЛЬКО ПО СЛОГУ.
 *
 * История: «Ср.морская» (2026-08-24) → две строки + auto-shrink →
 * «Морепродукт / ы» (2026-09-01) → правило по длине слова + auto-shrink →
 * «Морепродукты» и «Средиземноморская» МЕЛЬЧЕ соседей (скриншоты владельца
 * 2026-09-04). Auto-shrink и есть источник «разного кегля», поэтому он убран
 * совсем: кегль у всех подписей один (14/20 Medium из макета 3447:12767),
 * ячейка hug по подписи, длинное слово переносится явным `-\n` по слогу
 * (см. cuisine-label.ts).
 *
 * ЧЕГО ЭТИ ТЕСТЫ НЕ ДОКАЗЫВАЮТ: как платформа меряет ширину текста. В
 * react-native-web ячейка hug рисуется как flex-колонка с `min-width`, и это
 * проверяется здесь; что на iOS/Android ячейка действительно раздвигается под
 * «Морепродукты», проверяется только глазами на устройстве.
 */

// require(jpg/png) Node разобрать не может — подменяется только источник
// картинки, разметка подписи остаётся настоящей.
vi.mock("../cuisine-photos", () => ({ cuisinePhoto: () => undefined }));

const { CuisineChip } = await import("../CuisineChip");

const LIVE_NAMES = [
  "Европейская",
  "Казахская",
  "Грузинская",
  "Греческая",
  "Морепродукты",
  "Средиземноморская",
];

function renderChip(name: string) {
  render(<CuisineChip cuisine={{ id: name.toLowerCase(), name }} onSelect={vi.fn()} />);
  return screen.getByRole("button", { name: new RegExp(name) });
}

function labelOf(button: HTMLElement): HTMLElement {
  const label = Array.from(button.querySelectorAll("div, span")).find(
    (el) => el.childElementCount === 0 && (el.textContent ?? "").trim().length > 0,
  );
  if (!label) throw new Error("подпись под кругом не найдена");
  return label as HTMLElement;
}

describe("подпись под кружком кухни", () => {
  it("у всех кухонь один и тот же кегль из макета — без auto-shrink", () => {
    const sizes = new Set<string>();
    const lineHeightClasses = new Set<string>();
    for (const name of LIVE_NAMES) {
      const label = labelOf(renderChip(name));
      sizes.add(getComputedStyle(label).getPropertyValue("font-size"));
      // jsdom не резолвит line-height из таблицы стилей (отдаёт «normal»),
      // поэтому интерлиньяж сверяется по классу react-native-web и его правилу.
      const cls = Array.from(label.classList).find((c) => c.startsWith("r-lineHeight-"));
      if (cls) lineHeightClasses.add(cls);
    }
    expect(sizes).toEqual(new Set([`${typography.labelMedium.fontSize}px`]));
    expect(lineHeightClasses.size).toBe(1);
    const [lineHeightClass] = lineHeightClasses;
    const rule = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .find((r) => r.cssText.startsWith(`.${lineHeightClass} `));
    expect(rule?.cssText).toContain(`line-height: ${typography.labelMedium.lineHeight}px`);
    expect(typography.labelMedium.fontSize).toBe(14);
    expect(typography.labelMedium.lineHeight).toBe(20);
  });

  it("не использует adjustsFontSizeToFit / minimumFontScale", () => {
    // Проп до DOM не доезжает, поэтому проверяем по исходнику компонента:
    // это тот самый механизм, который давал «разный кегль».
    const source = JSON.stringify(CuisineChip.toString());
    expect(source).not.toContain("adjustsFontSizeToFit");
    expect(source).not.toContain("minimumFontScale");
  });

  it("«Морепродукты» стоит в одну строку целиком, без переноса и без сжатия", () => {
    const label = labelOf(renderChip("Морепродукты"));
    expect(label.textContent).toBe("Морепродукты");
    // react-native-web: numberOfLines={1} → white-space: nowrap. Разрыв
    // «Морепродукт / ы» при этом невозможен.
    expect(getComputedStyle(label).getPropertyValue("white-space")).toBe("nowrap");
  });

  it("«Средиземноморская» переносится по слогу: «Средиземно-» / «морская»", () => {
    const button = renderChip("Средиземноморская");
    const label = labelOf(button);
    expect(label.textContent).toBe("Средиземно-\nморская");
    expect(getComputedStyle(label).getPropertyValue("-webkit-line-clamp")).toBe("2");
    // Скринридеру — полное имя без дефиса.
    expect(button.getAttribute("aria-label")).toContain("Средиземноморская");
  });

  it("ячейка не уже круга и не зажата его шириной — подпись вправе быть шире", () => {
    const button = renderChip("Морепродукты");
    const style = getComputedStyle(button);
    expect(style.getPropertyValue("min-width")).toBe(`${exploreLayout.cuisineChip}px`);
    expect(style.getPropertyValue("width")).not.toBe(`${exploreLayout.cuisineChip}px`);
    expect(style.getPropertyValue("align-items")).toBe("center");
    // И у самой подписи ширина не задана — она меряет себя по тексту.
    expect(getComputedStyle(labelOf(button)).getPropertyValue("width")).not.toBe("100%");
  });

  it("остаётся кнопкой с названием кухни для скринридера", () => {
    expect(renderChip("Греческая")).toBeTruthy();
  });
});
