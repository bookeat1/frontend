import { describe, expect, it } from "vitest";
import { exploreLayout, listCard } from "../spacing";

/**
 * Размеры, сверенные по макету поимённо.
 *
 * Тест узкий нарочно — он держит те значения, которые уже уезжали от макета
 * «на глаз»: кружок кухни (сняли 72 с отрендеренного экрана вместо
 * нарисованных 96) и высота обложки карточки списка.
 *
 * Числа — из Figma 3z0f6dgev4HMwBAHPjTjPo, узлы указаны рядом. Менять их
 * можно, но только вместе с макетом: правка на глаз здесь падает, а не
 * расходится тихо.
 */
describe("размеры, сверенные с макетом", () => {
  it("карточка вертикального списка — 198 высотой, поля 18 (узел 3452:13345)", () => {
    expect(listCard.coverHeight).toBe(198);
    expect(listCard.contentPadding).toBe(18);
  });

  it("лента карточек — отступ и просвет по 16 (узел 3452:13343)", () => {
    expect(listCard.listPadding).toBe(16);
    expect(listCard.gap).toBe(16);
  });

  it("круг кухни и его ячейка — 96 (узел 3106:12348)", () => {
    expect(exploreLayout.cuisineChip).toBe(96);
    expect(exploreLayout.cuisineChipLabel).toBe(96);
  });
});
