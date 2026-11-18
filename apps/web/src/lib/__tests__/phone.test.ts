import { describe, expect, it } from "vitest";

import {
  DEFAULT_COUNTRY,
  formatNational,
  formatStoredPhone,
  isE164Complete,
  parsePhoneInput,
  toE164,
} from "@web/lib/phone";

/**
 * Сам разбор номера проверяется в `packages/phone`. Здесь — только то, что
 * у сайта своё: маска без скобок и то, что чужой номер не перекрашивается
 * в казахстанский.
 */
describe("номер телефона (веб)", () => {
  it("вынимает национальные цифры из любой человеческой записи", () => {
    for (const raw of [
      "7018692233",
      "+7 701 869-22-33",
      "87018692233",
      "8 (701) 869 22 33",
      "7 701 869 22 33",
    ]) {
      const value = parsePhoneInput(raw, DEFAULT_COUNTRY);
      expect(value.national).toBe("7018692233");
      expect(toE164(value)).toBe("+77018692233");
    }
  });

  it("маска из макета — «777 123-45-67», и она не дорисовывает лишнего", () => {
    expect(formatNational("", DEFAULT_COUNTRY)).toBe("");
    expect(formatNational("777", DEFAULT_COUNTRY)).toBe("777");
    expect(formatNational("777123", DEFAULT_COUNTRY)).toBe("777 123");
    expect(formatNational("7771234567", DEFAULT_COUNTRY)).toBe("777 123-45-67");
  });

  it("сохранённый номер показывается в маске сайта", () => {
    expect(formatStoredPhone("+77018692233")).toBe("+7 701 869-22-33");
    expect(formatStoredPhone("+12125551234")).toBe("+1 212 555-1234");
  });

  it("номер страны с неизвестным форматом не перекрашивается в «+7…»", () => {
    expect(formatStoredPhone("+4915112345678")).toBe("+4915112345678");
  });

  it("полнота номера считается по стране, а не по десяти цифрам", () => {
    expect(isE164Complete("+77018692233")).toBe(true);
    expect(isE164Complete("+7701869")).toBe(false);
    expect(isE164Complete("+4915112345678")).toBe(true);
    expect(isE164Complete("")).toBe(false);
  });
});
