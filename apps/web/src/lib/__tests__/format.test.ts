import { describe, expect, it } from "vitest";
import { getDictionary } from "@bookeat/i18n";

import { searchDateLabel } from "@web/lib/format";

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
