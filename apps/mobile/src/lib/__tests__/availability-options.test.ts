import { describe, expect, it } from "vitest";
import { dateOptions, guestOptions, HORIZON_DAYS, MAX_GUESTS } from "../availability-options";
import { toDateKey } from "../format";

/**
 * Колёса выбора обещают человеку, что перечисленное можно искать. Значение вне
 * серверных границ — компания на 30 человек, дата через полгода — вернёт пустую
 * выдачу без объяснения: заведения есть, столы есть, а «ничего не нашлось».
 * Поэтому границы проверяются, а не подразумеваются.
 */

describe("guestOptions", () => {
  it("не предлагает компанию больше той, что принимает сервер", () => {
    const options = guestOptions((n) => `${n}`);
    expect(options).toHaveLength(MAX_GUESTS);
    expect(options[0].value).toBe("1");
    expect(options.at(-1)!.value).toBe(String(MAX_GUESTS));
  });
});

describe("dateOptions", () => {
  const today = new Date(2026, 7, 13); // 13 августа 2026
  const labels = { today: "Сегодня", tomorrow: "Завтра", format: () => "дата" };

  it("начинается с сегодня и не уходит за горизонт бронирования", () => {
    const options = dateOptions(today, labels);
    expect(options).toHaveLength(HORIZON_DAYS + 1);
    expect(options[0].value).toBe(toDateKey(today));
    expect(options.at(-1)!.value).toBe(toDateKey(new Date(2026, 7, 13 + HORIZON_DAYS)));
  });

  it("называет ближайшие два дня словами, остальные — датой", () => {
    const options = dateOptions(today, labels);
    expect(options[0].label).toBe("Сегодня");
    expect(options[1].label).toBe("Завтра");
    expect(options[2].label).toBe("дата");
  });

  it("считает дату по местному календарю, а не по UTC", () => {
    // Вечер в Алматы (+05:00) по UTC — это уже предыдущий день. Сдвиг здесь
    // означал бы поиск не на тот день, причём только по вечерам.
    const evening = new Date(2026, 7, 13, 23, 30);
    expect(dateOptions(evening, labels)[0].value).toBe("2026-08-13");
  });
});
