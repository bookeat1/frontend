import { describe, expect, it } from "vitest";
import { getDictionary } from "@bookeat/i18n";

import { bookingDateLabel, searchDateLabel, slotDateIso, slotTimeLabel } from "@web/lib/format";

/**
 * Подпись поля даты в панели поиска. Проверяем именно её, потому что нативное
 * `<input type="date">` показывает «mm/dd/yyyy» и никакими атрибутами это не
 * лечится: русская дата на экране существует ровно постольку, поскольку её
 * считает эта функция.
 */
describe("searchDateLabel", () => {
  const ru = getDictionary("ru");
  const en = getDictionary("en");

  it("печатает день и месяц по-русски, без точки после сокращения", () => {
    expect(searchDateLabel("2026-09-06", "ru", ru)).toBe("6 сент");
  });

  it("сегодняшний день называет словом, как в макете", () => {
    expect(searchDateLabel("2026-08-25", "ru", ru, "2026-08-25")).toBe("Сегодня, 25 авг");
    expect(searchDateLabel("2026-08-26", "ru", ru, "2026-08-25")).toBe("26 авг");
  });

  it("не считает день сегодняшним, пока сегодняшняя дата неизвестна", () => {
    // На сервере её не считают намеренно — часовой пояс там другой.
    expect(searchDateLabel("2026-08-25", "ru", ru, null)).toBe("25 авг");
  });

  it("переводится вместе с интерфейсом", () => {
    expect(searchDateLabel("2026-08-25", "en", en, "2026-08-25")).toBe("Today, Aug 25");
  });

  it("на мусор отвечает null, а не «Invalid Date»", () => {
    expect(searchDateLabel("", "ru", ru)).toBeNull();
    expect(searchDateLabel("25.08.2026", "ru", ru)).toBeNull();
    expect(searchDateLabel("2026-13-45", "ru", ru)).not.toBe("Invalid Date");
  });
});

/**
 * Время слота брони.
 *
 * Час берётся ИЗ СТРОКИ, а не из `new Date(...)`. Слот приходит со смещением
 * ЗАВЕДЕНИЯ, и это стенные часы ресторана — то время, на которое гостя ждут за
 * столом. Пересчёт в пояс браузера показал бы гостю из другого пояса чужое
 * число на кнопке «Забронировать на …», и он пришёл бы не в тот час.
 */
describe("slotTimeLabel", () => {
  it("печатает час заведения, а не пересчитанный в пояс браузера", () => {
    // Тесты идут в TZ=Asia/Almaty (UTC+5). Через `Date` это стало бы «22:30».
    expect(slotTimeLabel("2026-08-25T19:30:00+02:00")).toBe("19:30");
  });

  it("не съезжает на сутки у слота, который в UTC уже другой день", () => {
    expect(slotTimeLabel("2026-08-25T01:00:00+05:00")).toBe("01:00");
    expect(slotDateIso("2026-08-25T01:00:00+05:00")).toBe("2026-08-25");
  });

  it("неразобранное время — пустая строка, а не «Invalid Date» на кнопке", () => {
    expect(slotTimeLabel("завтра вечером")).toBe("");
    expect(slotDateIso("завтра вечером")).toBeNull();
  });
});

/** Дата в карточке брони — полный месяц в родительном падеже («25 августа»),
 * в отличие от сокращённого «25 авг» в панели поиска. */
describe("bookingDateLabel", () => {
  it("склоняет месяц по-русски", () => {
    expect(bookingDateLabel("2026-08-25", "ru")).toBe("25 августа");
  });

  it("не съезжает на сутки на границе месяца", () => {
    expect(bookingDateLabel("2026-09-01", "ru")).toBe("1 сентября");
  });

  it("мусор на входе — null, а не «Invalid Date»", () => {
    expect(bookingDateLabel("25.08.2026", "ru")).toBeNull();
  });
});
