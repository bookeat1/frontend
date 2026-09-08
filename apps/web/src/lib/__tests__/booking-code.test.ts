import { describe, expect, it } from "vitest";

import { bookingCode, bookingQrPayload } from "@web/lib/booking-code";

/**
 * Код брони выводится ИЗ идентификатора детерминированно: одна бронь — один
 * код в любом браузере. У сервера поля «код» нет.
 */
describe("bookingCode", () => {
  it("первые восемь шестнадцатеричных знаков UUID заглавными, пополам", () => {
    expect(bookingCode("a1b2c3d4-0000-4000-8000-000000000001")).toBe("BE-A1B2-C3D4");
    expect(bookingCode("A1B2C3D4-0000-4000-8000-000000000001")).toBe("BE-A1B2-C3D4");
  });

  it("на обрезанный или нешестнадцатеричный идентификатор отвечает null, а не «BE--»", () => {
    expect(bookingCode("booking-1")).toBeNull();
    expect(bookingCode("")).toBeNull();
    expect(bookingCode("abc")).toBeNull();
  });
});

describe("bookingQrPayload", () => {
  it("несёт идентификатор дословно, без схемы и префикса", () => {
    expect(bookingQrPayload(" a1b2c3d4-0000-4000-8000-000000000001 ")).toBe(
      "a1b2c3d4-0000-4000-8000-000000000001",
    );
  });
});
