import { describe, expect, it } from "vitest";

import {
  FREE_CANCEL_WINDOW_MAX_MINUTES,
  FREE_CANCEL_WINDOW_MIN_MINUTES,
  parseFreeCancelWindowMinutes,
} from "../admin/free-cancel-window";

/**
 * Пустая/нечисловая строка — «нет собственного значения», вызывающая сторона
 * (VenuesView) подставляет платформенный дефолт сама: у этой ручки нет
 * сентинела «сбросить», колонка NOT NULL.
 */
describe("parseFreeCancelWindowMinutes", () => {
  it("пустая и нечисловая строка → null", () => {
    expect(parseFreeCancelWindowMinutes("")).toBeNull();
    expect(parseFreeCancelWindowMinutes("   ")).toBeNull();
    expect(parseFreeCancelWindowMinutes("abc")).toBeNull();
  });

  it("обычное число проходит как есть", () => {
    expect(parseFreeCancelWindowMinutes("90")).toBe(90);
    expect(parseFreeCancelWindowMinutes(" 120 ")).toBe(120);
    expect(parseFreeCancelWindowMinutes("0")).toBe(0);
  });

  it("отрицательное значение зажимается в 0, а не уходит на сервер как есть", () => {
    expect(parseFreeCancelWindowMinutes("-30")).toBe(FREE_CANCEL_WINDOW_MIN_MINUTES);
  });

  it("значение сверх недельного потолка зажимается в максимум", () => {
    expect(parseFreeCancelWindowMinutes(String(FREE_CANCEL_WINDOW_MAX_MINUTES + 1000))).toBe(
      FREE_CANCEL_WINDOW_MAX_MINUTES,
    );
  });

  it("дробная строка усечена так же, как parseInt", () => {
    expect(parseFreeCancelWindowMinutes("45.9")).toBe(45);
  });
});
