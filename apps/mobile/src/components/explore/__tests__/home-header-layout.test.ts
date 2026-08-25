import { exploreLayout } from "@bookeat/design-tokens";
import { describe, expect, it } from "vitest";
import { homeHeaderHeight } from "../home-header-layout";

/**
 * Правило высоты шапки главной, а не её отрисовка: сама `HomeHeader` в vitest
 * не рендерится (`require` локального jpg), поэтому проверяемая часть вынесена
 * в отдельный модуль.
 *
 * Макет 3z0f6dgev4HMwBAHPjTjPo, node 3102:11986: рамка 375x308, из 308 —
 * 44 статус-бар. Значит под безопасной зоной всегда 264, а полная высота
 * зависит от устройства.
 */
describe("homeHeaderHeight", () => {
  it("на устройстве макета (вставка 44) даёт нарисованные 308", () => {
    expect(homeHeaderHeight(44)).toBe(308);
  });

  it("это вставка + 264, а не жёсткие 308: на разных вставках высота разная", () => {
    // Старый iPhone SE / Android без выреза, iPhone 14 Pro, Pixel с камерой
    // в экране — под содержимое везде остаётся ровно 264.
    expect(homeHeaderHeight(20)).toBe(284);
    expect(homeHeaderHeight(59)).toBe(323);
    expect(homeHeaderHeight(62)).toBe(326);
  });

  it("без безопасной зоны (вставка 0) остаётся ровно содержательная часть", () => {
    expect(homeHeaderHeight(0)).toBe(exploreLayout.headerContentHeight);
    expect(exploreLayout.headerContentHeight).toBe(264);
  });

  it("содержимое шапки в эту высоту помещается", () => {
    // Раскладка сверху вниз, значения — из стилей `HomeHeader`:
    // paddingTop 16 + строка города 44 + gap 16 + приветствие максимум в две
    // строки по 32 + gap 16 + капсула 48 + paddingBottom 20.
    const contentAtWorstCase = 16 + 44 + 16 + 2 * 32 + 16 + 48 + 20;
    expect(contentAtWorstCase).toBeLessThanOrEqual(exploreLayout.headerContentHeight);
  });
});
