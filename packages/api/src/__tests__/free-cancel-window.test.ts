import { describe, expect, it } from "vitest";

import {
  FREE_CANCEL_WINDOW_MAX_MINUTES,
  FREE_CANCEL_WINDOW_MIN_MINUTES,
  initialFreeCancelMinutesField,
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

/**
 * Регрессия прод-бага 23.09.2026: заведение сохранило окно в 1 минуту, и
 * после перезагрузки страницы кабинет показывал «0» — единственным чтением
 * были округлённые вниз часы (1 минута = 0 часов). initialFreeCancelMinutesField
 * теперь предпочитает точное поле и только при его отсутствии падает на
 * часы × 60.
 */
describe("initialFreeCancelMinutesField", () => {
  it("предпочитает точное поле, даже когда часы округлились до 0", () => {
    expect(
      initialFreeCancelMinutesField({
        free_cancel_window_minutes: 1,
        booking_rules: { free_cancel_hours: 0 },
      }),
    ).toBe("1");
  });

  it("предпочитает точное поле для не выровненных по часу значений (90 мин = 1.5 ч)", () => {
    expect(
      initialFreeCancelMinutesField({
        free_cancel_window_minutes: 90,
        booking_rules: { free_cancel_hours: 2 },
      }),
    ).toBe("90");
  });

  it("падает на часы × 60, когда точного поля нет (старая сборка сервера)", () => {
    expect(
      initialFreeCancelMinutesField({
        booking_rules: { free_cancel_hours: 3 },
      }),
    ).toBe("180");
  });

  it("точное поле 0 — валидное значение, не путается с «отсутствует»", () => {
    expect(
      initialFreeCancelMinutesField({
        free_cancel_window_minutes: 0,
        booking_rules: { free_cancel_hours: 1 },
      }),
    ).toBe("0");
  });

  it("ни точного поля, ни часов — пустая строка", () => {
    expect(initialFreeCancelMinutesField({})).toBe("");
    expect(initialFreeCancelMinutesField({ booking_rules: null })).toBe("");
  });
});
