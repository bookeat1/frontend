import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SHEET_TRAVEL, useSheetAnimation } from "../sheet-animation";

/**
 * Ход шторки вниз в закрытом состоянии обязан быть не меньше её высоты — иначе
 * верх панели торчит из-под низа экрана при открытии и исчезает рывком при
 * закрытии (ревью PR #118, п. 1.1: Welcome drink ≈ 743 pt при ходе 640).
 *
 * Читаем текущее значение интерполяции напрямую (`__getValue`): при
 * `progress = 0` (закрыта) оно и есть ход панели.
 */
function closedOffset(travel?: number): number {
  const { result } = renderHook(() => useSheetAnimation(false, travel));
  const translateY = result.current.translateY as unknown as { __getValue: () => number };
  return translateY.__getValue();
}

describe("useSheetAnimation — ход панели", () => {
  it("без параметра — прежние 640, поведение шести существующих шторок не меняется", () => {
    expect(closedOffset()).toBe(SHEET_TRAVEL);
    expect(SHEET_TRAVEL).toBe(640);
  });

  it("шторка выше 640 передаёт свой ход и уезжает на всю его величину", () => {
    // Высота окна iPhone 14 — ровно тот случай, где 640 не хватало.
    expect(closedOffset(844)).toBe(844);
  });

  it("ход меньше умолчания не принимается: короче 640 ехать незачем", () => {
    expect(closedOffset(500)).toBe(SHEET_TRAVEL);
  });
});
