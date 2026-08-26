import { describe, expect, it } from "vitest";
import { birthdayStepFor, parseNewUserParam, postSignInStep } from "../onboarding";

/**
 * КОМУ показывается шаг даты рождения.
 *
 * Правило владельца: новому клиенту — да, существующему — нет, он правит дату
 * в персональных данных. Самый вероятный способ это сломать — начать считать
 * новым того, у кого просто пустая дата рождения: таких среди давних гостей
 * большинство, и они получили бы экран регистрации на ровном месте.
 */
describe("шаг после входа", () => {
  const withName = { fullName: "Дамир", birthDate: null };

  it("новый аккаунт с именем идёт на дату рождения", () => {
    expect(postSignInStep({ isNewUser: true, account: withName })).toBe("birthday");
  });

  it("ДАВНИЙ гость без даты рождения не видит ничего", () => {
    expect(postSignInStep({ isNewUser: false, account: withName })).toBe("none");
    expect(birthdayStepFor({ isNewUser: false, account: withName })).toBe("none");
  });

  it("молчание сервера («не сказал») считается «не новый»", () => {
    // Сегодняшний бэкенд не отдаёт is_new_user вовсе. Пока он молчит, шаг не
    // показывается никому — лишний экран у давнего гостя хуже, чем
    // непоказанный у нового.
    expect(postSignInStep({ isNewUser: null, account: withName })).toBe("none");
  });

  it("пустое имя ведёт на шаг имени независимо от новизны", () => {
    const nameless = { fullName: "", birthDate: null };
    expect(postSignInStep({ isNewUser: true, account: nameless })).toBe("name");
    expect(postSignInStep({ isNewUser: false, account: nameless })).toBe("name");
    // И имя из одних пробелов — тоже пустое.
    expect(postSignInStep({ isNewUser: false, account: { fullName: "   ", birthDate: null } })).toBe(
      "name",
    );
  });

  it("новому аккаунту с уже заполненной датой шаг не нужен", () => {
    expect(
      postSignInStep({ isNewUser: true, account: { fullName: "Дамир", birthDate: "1990-05-04" } }),
    ).toBe("none");
  });

  it("профиль не прочитался — гостя никуда не запирают", () => {
    expect(postSignInStep({ isNewUser: true, account: null })).toBe("none");
  });

  it("признак новизны переживает переход между экранами онбординга", () => {
    expect(parseNewUserParam("1")).toBe(true);
    expect(parseNewUserParam("0")).toBe(false);
    // Ни отсутствующий, ни мусорный параметр не становится «новым».
    expect(parseNewUserParam(undefined)).toBeNull();
    expect(parseNewUserParam("да")).toBeNull();
  });
});
