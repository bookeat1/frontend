import { describe, expect, it } from "vitest";
import {
  birthDateInputFromDateKey,
  maskBirthDateInput,
  parseBirthDateInput,
} from "../birth-date-input";

/**
 * Ввод даты рождения ЦИФРАМИ (правка владельца 2026-09-01).
 *
 * Проверяются границы, а не середина: несуществующий день, завтрашний день,
 * день на границе «слишком старо», недописанная дата. Каждая из них молча
 * ломается по-своему — 31.02 `new Date` превращает в 3 марта, будущая дата
 * доезжает до сервера и возвращается непонятным 422.
 */

/** Полдень UTC, чтобы «сегодня» не зависело от часа прогона. */
const NOW = new Date("2026-09-01T12:00:00.000Z");

describe("maskBirthDateInput", () => {
  it("расставляет точки сам и берёт только цифры", () => {
    expect(maskBirthDateInput("04051990")).toBe("04.05.1990");
    expect(maskBirthDateInput("0405")).toBe("04.05");
    expect(maskBirthDateInput("04")).toBe("04");
    expect(maskBirthDateInput("04 05 1990")).toBe("04.05.1990");
    expect(maskBirthDateInput("04.05.1990")).toBe("04.05.1990");
  });

  it("не дописывает хвостовую точку — иначе её нельзя было бы стереть", () => {
    // После двух цифр поле показывает «04», а не «04.»: маска, возвращающая
    // точку после каждого backspace, делает поле неудаляемым.
    expect(maskBirthDateInput("04")).toBe("04");
    expect(maskBirthDateInput("04.")).toBe("04");
  });

  it("обрезает лишние цифры вместо того, чтобы принять 2019904", () => {
    expect(maskBirthDateInput("040519901234")).toBe("04.05.1990");
  });
});

describe("parseBirthDateInput", () => {
  it("пустое поле — это не ошибка", () => {
    expect(parseBirthDateInput("", NOW)).toEqual({ status: "empty" });
  });

  it("недописанная дата — отдельный исход, а не «неверная»", () => {
    expect(parseBirthDateInput("04.05.19", NOW)).toEqual({ status: "incomplete" });
    expect(parseBirthDateInput("04.05.199", NOW)).toEqual({ status: "incomplete" });
  });

  it("31 февраля не превращается в 3 марта, а отвергается", () => {
    expect(parseBirthDateInput("31.02.1992", NOW)).toEqual({
      status: "invalid",
      error: "birth_date_format",
    });
  });

  it("нулевой день и тринадцатый месяц тоже не проходят", () => {
    expect(parseBirthDateInput("00.05.1990", NOW)).toEqual({
      status: "invalid",
      error: "birth_date_format",
    });
    expect(parseBirthDateInput("04.13.1990", NOW)).toEqual({
      status: "invalid",
      error: "birth_date_format",
    });
  });

  it("29 февраля високосного года — настоящая дата и проходит", () => {
    expect(parseBirthDateInput("29.02.1992", NOW)).toEqual({
      status: "ok",
      dateKey: "1992-02-29",
    });
  });

  it("сегодняшний и завтрашний день отвергаются как «не в прошлом»", () => {
    // Клиент на день строже сервера: «сегодня» в UTC пять часов в сутки ещё
    // «вчера» в Алматы, и сервер решает про этот день по-разному.
    expect(parseBirthDateInput("01.09.2026", NOW)).toEqual({
      status: "invalid",
      error: "birth_date_not_past",
    });
    expect(parseBirthDateInput("02.09.2026", NOW)).toEqual({
      status: "invalid",
      error: "birth_date_not_past",
    });
  });

  it("вчерашний день — последняя допустимая дата", () => {
    expect(parseBirthDateInput("31.08.2026", NOW)).toEqual({
      status: "ok",
      dateKey: "2026-08-31",
    });
  });

  it("слишком старая дата названа своей причиной, а не «неверным форматом»", () => {
    expect(parseBirthDateInput("01.01.1830", NOW)).toEqual({
      status: "invalid",
      error: "birth_date_too_old",
    });
    // Ровно 120 лет назад — тоже за границей (клиент на день строже сервера).
    expect(parseBirthDateInput("01.09.1906", NOW)).toEqual({
      status: "invalid",
      error: "birth_date_too_old",
    });
    expect(parseBirthDateInput("02.09.1906", NOW)).toEqual({
      status: "ok",
      dateKey: "1906-09-02",
    });
  });

  it("отдаёт наружу ключ даты «YYYY-MM-DD» — формат отправки не изменился", () => {
    expect(parseBirthDateInput("04.05.1990", NOW)).toEqual({
      status: "ok",
      dateKey: "1990-05-04",
    });
  });
});

describe("birthDateInputFromDateKey", () => {
  it("разворачивает ключ даты обратно в «дд.мм.гггг»", () => {
    expect(birthDateInputFromDateKey("1990-05-04")).toBe("04.05.1990");
  });

  it("на пустом и на мусоре отдаёт пустую строку, а не «undefined»", () => {
    expect(birthDateInputFromDateKey("")).toBe("");
    expect(birthDateInputFromDateKey("1990-05")).toBe("");
  });
});
