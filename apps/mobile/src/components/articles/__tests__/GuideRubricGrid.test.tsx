import type { GuideCollection } from "@bookeat/api";
import { guideLayout } from "@bookeat/design-tokens";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { GuideRubricGrid, rubricColumnWidth, rubricLabel } from "../GuideRubricGrid";

/**
 * «Рубрики» гастрогида — СЕТКА в две колонки (макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 3192:6246; ряды 3566:7284 и 3566:7305, плитки 3566:7275 и соседние).
 *
 * Правка владельца 2026-09-01: «рубрики должны выглядеть плиткой». До этого
 * это была горизонтальная лента плиток фиксированной ширины 118 — так был
 * нарисован предыдущий вариант макета.
 *
 * Что здесь проверяемо в jsdom: арифметика колонок, то что рисуются ВСЕ
 * рубрики (а не первые четыре, как нарисовано), надписи и переход по нажатию.
 * Чего проверить нельзя: перенос по рядам — раскладку flex-wrap меряет
 * платформа, в jsdom ширины нулевые. Это остаётся проверкой на устройстве.
 */

function collection(slug: string, title: string, categorySlugs: string[]): GuideCollection {
  return {
    slug,
    kind: "collection",
    title,
    subtitle: "",
    description: "",
    coverImageUrl: null,
    venueCount: 3,
    categorySlugs,
  };
}

const RUBRICS = [
  collection("kazakh", "Казахская кухня", ["kazakh-cuisine"]),
  collection("coffee", "Кофейная культура", ["people"]),
  collection("mountains", "Горы и гастрономия", ["places"]),
  collection("wine", "Винные бары", ["drinks"]),
  collection("fifth", "Пятая рубрика", ["extra"]),
];

describe("сетка рубрик", () => {
  it("две равные колонки: ширина = (лист − просвет) / 2", () => {
    // Кадр макета 375, лист 343 (поля 16), просвет 12 → 165 после округления
    // вниз: лишние полпикселя должны остаться в просвете, а не выдавить
    // вторую плитку на следующий ряд.
    expect(rubricColumnWidth(375)).toBe(165);
    // Самый узкий реальный телефон.
    expect(rubricColumnWidth(360)).toBe(158);
    // Две колонки плюс просвет обязаны помещаться в лист, а не наоборот.
    for (const screenWidth of [360, 375, 390, 412, 430]) {
      const column = rubricColumnWidth(screenWidth);
      const content = screenWidth - guideLayout.contentPaddingHorizontal * 2;
      expect(column * 2 + guideLayout.rubricGap).toBeLessThanOrEqual(content);
    }
  });

  it("рисует ВСЕ рубрики, а не первые четыре из макета", () => {
    render(<GuideRubricGrid collections={RUBRICS} onPress={vi.fn()} />);
    for (const item of RUBRICS) {
      expect(screen.getByText(item.title)).toBeTruthy();
    }
  });

  it("подписывает плитку рубрикой заглавными, а без рубрики — не подписывает", () => {
    expect(rubricLabel(["kazakh-cuisine"])).toBe("KAZAKH CUISINE");
    expect(rubricLabel(["  "])).toBe("");
    expect(rubricLabel([])).toBe("");
  });

  it("нажатие отдаёт наружу подборку целиком — слаг выбирает экран", () => {
    const onPress = vi.fn();
    render(<GuideRubricGrid collections={RUBRICS} onPress={onPress} />);

    fireEvent.click(screen.getByRole("button", { name: /Казахская кухня/ }));

    expect(onPress).toHaveBeenCalledWith(RUBRICS[0]);
  });

  it("рубрик нет — сетки нет вовсе, а не пустой рамки", () => {
    const { container } = render(<GuideRubricGrid collections={[]} onPress={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
