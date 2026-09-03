import { describe, expect, it } from "vitest";

import {
  formatForDisplay,
  formatNational,
  isComplete,
  kzNationalDigits,
  nationalDigits,
  toE164,
} from "@web/lib/phone";

/**
 * Разбор номера — единственное место, где гость может «правильно набрать» и
 * получить отказ сервера. Поэтому проверяются именно те формы, которые люди
 * вставляют из буфера, а не только идеальные десять цифр.
 */
describe("номер телефона (веб, только KZ)", () => {
  it("вынимает национальные цифры из любой человеческой записи", () => {
    for (const raw of [
      "7018692233",
      "+7 701 869-22-33",
      "87018692233",
      "8 (701) 869 22 33",
      "7 701 869 22 33",
    ]) {
      expect(nationalDigits(raw)).toBe("7018692233");
    }
  });

  /** Ведущая «8» — часть номера, пока цифр не больше десяти: иначе номер,
   * начинающийся на 8, терял бы первую цифру прямо во время набора. */
  it("не срезает ведущую восьмёрку, пока номер ещё короткий", () => {
    expect(nationalDigits("8")).toBe("8");
    expect(nationalDigits("87")).toBe("87");
  });

  it("не пускает больше десяти цифр", () => {
    expect(nationalDigits("70186922339999")).toHaveLength(10);
  });

  it("маска из макета — «777 123-45-67», и она не дорисовывает лишнего", () => {
    expect(formatNational("")).toBe("");
    expect(formatNational("777")).toBe("777");
    expect(formatNational("777123")).toBe("777 123");
    expect(formatNational("7771234567")).toBe("777 123-45-67");
  });

  it("на сервер уходит E.164", () => {
    expect(toE164("7018692233")).toBe("+77018692233");
    expect(formatForDisplay("7018692233")).toBe("+7 701 869-22-33");
  });

  it("полным считается ровно десятизначный номер", () => {
    expect(isComplete("701869223")).toBe(false);
    expect(isComplete("7018692233")).toBe(true);
  });

  /** Обратный разбор — для номера, который уже ХРАНИТСЯ (профиль, бронь). */
  describe("kzNationalDigits: из E.164 обратно в поле", () => {
    it("казахстанский номер отдаёт десять национальных цифр", () => {
      expect(kzNationalDigits("+77018692233")).toBe("7018692233");
      expect(kzNationalDigits("+7 701 869-22-33")).toBe("7018692233");
    });

    it("ИНОСТРАННЫЙ номер — null, а не первые десять цифр с приклеенным «+7»", () => {
      // Аккаунт из мобильного приложения с выбором страны. Раньше
      // `nationalDigits` делал из него «4915112345», и бронь уходила с
      // фальшивым «+74915112345».
      expect(kzNationalDigits("+4915112345678")).toBeNull();
      expect(nationalDigits("+4915112345678")).toBe("4915112345");
    });

    it("неполный, пустой и слишком длинный — тоже null", () => {
      expect(kzNationalDigits("")).toBeNull();
      expect(kzNationalDigits("+7701869223")).toBeNull();
      expect(kzNationalDigits("+770186922334")).toBeNull();
    });
  });
});
