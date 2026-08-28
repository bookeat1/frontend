import { describe, expect, it } from "vitest";

import { coordinateFieldValue, parsePointCoordinates } from "../route-point";

/**
 * ЗАЩИТА ОТ МОЛЧАЛИВОЙ ОШИБКИ — координаты остановки гастропрогулки.
 *
 * Пара широта/долгота — одно значение из двух полей, и все три интересных
 * исхода здесь ошибаются молча, если их не проверить:
 *
 *  1. Пусто — это НЕ ноль. `Number("")` даёт 0, и остановка без точки на карте
 *     уехала бы в Гвинейский залив с булавкой в приложении.
 *  2. Заполнено одно поле — полкоординаты бесполезны, и отправлять их нельзя.
 *  3. Перепутанные местами широта и долгота Алматы остаются числами, но 76.9
 *     в поле широты — уже вне диапазона, и это единственное место, где такую
 *     опечатку ловят до записи.
 */

describe("координаты остановки", () => {
  it("оба поля пусты — это «нет точки», а не 0,0", () => {
    expect(parsePointCoordinates("", "")).toEqual({ kind: "none" });
    expect(parsePointCoordinates("   ", "\t")).toEqual({ kind: "none" });
  });

  it("оба поля заполнены — число и число", () => {
    expect(parsePointCoordinates("43.238949", "76.889709")).toEqual({
      kind: "ok",
      latitude: 43.238949,
      longitude: 76.889709,
    });
  });

  it("запятая как разделитель — то, что реально набирают", () => {
    expect(parsePointCoordinates("43,24", "76,89")).toEqual({
      kind: "ok",
      latitude: 43.24,
      longitude: 76.89,
    });
  });

  it("заполнено ровно одно поле — половина координаты не отправляется", () => {
    expect(parsePointCoordinates("43.24", "")).toEqual({ kind: "incomplete" });
    expect(parsePointCoordinates("", "76.89")).toEqual({ kind: "incomplete" });
  });

  it("не число — отказ", () => {
    expect(parsePointCoordinates("север", "76.89")).toEqual({ kind: "invalid" });
    expect(parsePointCoordinates("43.24", "")).not.toEqual({ kind: "invalid" });
  });

  it("число вне диапазона широты — отказ", () => {
    // Долгота, попавшая в поле широты, ловится ровно тогда, когда она больше
    // 90. Перепутанные местами координаты Алматы (43.2 / 76.9) остаются
    // валидными обеими сторонами — этого разбор координат поймать НЕ может, и
    // делать вид, что может, было бы обманом: такую ошибку видно только на
    // карте.
    expect(parsePointCoordinates("120.5", "43.238949")).toEqual({ kind: "invalid" });
    expect(parsePointCoordinates("76.889709", "43.238949").kind).toBe("ok");
  });

  it("границы диапазона допустимы, а шаг за них — нет", () => {
    expect(parsePointCoordinates("90", "180").kind).toBe("ok");
    expect(parsePointCoordinates("-90", "-180").kind).toBe("ok");
    expect(parsePointCoordinates("90.1", "0")).toEqual({ kind: "invalid" });
    expect(parsePointCoordinates("0", "-180.1")).toEqual({ kind: "invalid" });
  });

  it("ноль — настоящая координата, а не «пусто»", () => {
    expect(parsePointCoordinates("0", "0")).toEqual({ kind: "ok", latitude: 0, longitude: 0 });
  });

  it("в поле формы null показывается пустым, а ноль — нулём", () => {
    expect(coordinateFieldValue(null)).toBe("");
    expect(coordinateFieldValue(undefined)).toBe("");
    expect(coordinateFieldValue(0)).toBe("0");
    expect(coordinateFieldValue(43.24)).toBe("43.24");
  });
});
