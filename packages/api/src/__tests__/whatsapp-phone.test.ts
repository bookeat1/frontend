import { describe, expect, it } from "vitest";

import { isWhatsAppPhoneShaped, normalizeWhatsAppPhone } from "../admin/whatsapp-phone";

/**
 * Панель обязана отправлять ровно ту строку, которую сервер сохранит: иначе
 * управляющий видит в поле одно, а нажатия кнопки в сообщении приходят с
 * другого номера и не находят заведение — молча, без ошибки.
 */
describe("normalizeWhatsAppPhone", () => {
  // Те же случаи, что в internal/auth/phone/phone_test.go.
  it.each([
    ["8 707 123 4567", "+77071234567"],
    ["+7 707 123 4567", "+77071234567"],
    ["77071234567", "+77071234567"],
    ["7071234567", "+77071234567"],
    ["+1 202 555 0100", "+12025550100"],
    ["", ""],
  ])("%s → %s", (raw, want) => {
    expect(normalizeWhatsAppPhone(raw)).toBe(want);
  });
});

describe("isWhatsAppPhoneShaped", () => {
  it("принимает международный номер и отвергает недобранный", () => {
    expect(isWhatsAppPhoneShaped("+77071234567")).toBe(true);
    // Тот же порог, что на бэкенде: короче 12 символов — 422.
    expect(isWhatsAppPhoneShaped("+7707123")).toBe(false);
    expect(isWhatsAppPhoneShaped("")).toBe(false);
  });
});
