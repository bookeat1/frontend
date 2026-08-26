import { describe, expect, it } from "vitest";
import { fontFamilies } from "../fonts";
import { typography } from "../typography";

/**
 * Кегли, сверенные по макету поимённо.
 *
 * Тест узкий нарочно: он не описывает всю шкалу, а держит те несколько
 * значений, которые уже дважды уезжали от макета молча — заголовки секций
 * главной (их когда-то уменьшили целиком, потом вернули к макету ОДИН из
 * пяти, «Афишу», и главная поехала внутри себя) и приветствие в шапке.
 *
 * Числа — из Figma 3z0f6dgev4HMwBAHPjTjPo, узлы указаны рядом. Менять их можно,
 * но только вместе с макетом: правка «на глаз» здесь падает, а не расходится
 * тихо.
 */
describe("типографика, сверенная с макетом", () => {
  it("заголовок секции — 20/28 Bold (узлы 3102:12008, 3102:12025, 3228:9821)", () => {
    expect(typography.titleSection).toEqual({
      fontFamily: fontFamilies.notoSansBold,
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: 0,
    });
  });

  it("приветствие в шапке — 24/32 Bold (узел 3102:11996)", () => {
    expect(typography.titleXxl.fontSize).toBe(24);
    expect(typography.titleXxl.lineHeight).toBe(32);
    expect(typography.titleXxl.fontFamily).toBe(fontFamilies.notoSansBold);
  });

  it("название карточки на главной — 16/24 SemiBold, а не Bold (узел 3102:12015)", () => {
    // Вес 590 в макете — это SemiBold. `titleSm` того же кегля, но Bold:
    // карточки главной на него больше не ссылаются.
    expect(typography.itemName).toEqual({
      fontFamily: fontFamilies.notoSansSemiBold,
      fontSize: 16,
      lineHeight: 24,
    });
  });

  it("подпись кухни и плашка скидки — 14/20 Medium (узлы 3106:12351, 3102:12047)", () => {
    expect(typography.labelMedium).toEqual({
      fontFamily: fontFamilies.notoSansMedium,
      fontSize: 14,
      lineHeight: 20,
    });
  });
});
