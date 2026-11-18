import { describe, expect, it } from "vitest";
import { formatStoredPhoneForDisplay } from "../phone";

/**
 * REGRESSION GUARD — «Профиль» показывал номер в том виде, в каком его хранит
 * сервер.
 *
 * The guest signs in by typing `+7 (701) 000-00-00` into a masked field, and
 * then finds `+77010000000` under «Телефон» in their profile. It is the same
 * number, but it does not read as one: no brackets, no groups, thirteen
 * characters to scan by eye to check it is really their number. This file
 * pins the display mask, and one trap inside it.
 *
 * THE TRAP: the obvious implementation is
 * `formatE164ForDisplay(extractNationalDigits(raw))`. `extractNationalDigits`
 * exists to clean up what a guest PASTES into a Kazakh phone field, so it
 * truncates to ten digits — feed it "+12125551234" and it returns "2125551234",
 * which prints as "+7 (121) 255-51-23". That is a different number, invented
 * by the formatter and shown to the guest as their own. A number that is not a
 * +7 one must come back untouched.
 */
describe("номер в профиле", () => {
  it("хранимый E.164 показывается той же маской, что и на входе", () => {
    expect(formatStoredPhoneForDisplay("+77010000000")).toBe("+7 (701) 000-00-00");
    expect(formatStoredPhoneForDisplay("+77775474747")).toBe("+7 (777) 547-47-47");
  });

  it("уже отформатированный номер не ломается", () => {
    expect(formatStoredPhoneForDisplay("+7 (707) 547-47-47")).toBe("+7 (707) 547-47-47");
  });

  it("восьмёрка и десять цифр без кода — тот же номер", () => {
    expect(formatStoredPhoneForDisplay("87010000000")).toBe("+7 (701) 000-00-00");
    expect(formatStoredPhoneForDisplay("7010000000")).toBe("+7 (701) 000-00-00");
  });

  it("иностранный номер не превращается в чужой казахстанский", () => {
    // Ровно тот случай, ради которого написан этот файл. Требование прежнее и
    // не ослаблено: американский номер обязан остаться американским. Изменился
    // только вид — с появлением выбора страны у поля мы знаем формат США и
    // показываем номер ИМ, а не отдаём сырую строку. Ключевая проверка та же:
    // «+7» в результате быть не может.
    expect(formatStoredPhoneForDisplay("+12125551234")).toBe("+1 (212) 555-1234");
    expect(formatStoredPhoneForDisplay("+12125551234")).not.toContain("+7");
    // Формат Великобритании мы не знаем и не выдумываем — номер как есть.
    expect(formatStoredPhoneForDisplay("+442071838750")).toBe("+442071838750");
  });

  it("непонятная длинная строка цифр не подгоняется под казахстанскую маску", () => {
    // Парсеру поля позволено отбрасывать цифры, которые он не смог разместить,
    // — ему надо оставить поле пригодным для ввода. Показу это не позволено:
    // обрезанные до десяти цифры нарисовались бы как чужой номер «+7 (999)…».
    expect(formatStoredPhoneForDisplay("099999999999")).toBe("099999999999");
  });

  it("то, что вообще не похоже на номер, показывается как есть", () => {
    expect(formatStoredPhoneForDisplay("не указан")).toBe("не указан");
    expect(formatStoredPhoneForDisplay("+7701")).toBe("+7701");
    expect(formatStoredPhoneForDisplay("")).toBe("");
  });
});
