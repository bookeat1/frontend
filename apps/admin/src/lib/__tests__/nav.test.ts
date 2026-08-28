import { describe, expect, it } from "vitest";

import { NAV, activeNavHref, isPlatformRoute } from "../nav";

/**
 * ПОДСВЕТКА МЕНЮ — ровно один пункт.
 *
 * Пока пункты меню не вкладывались друг в друга, «pathname начинается с href»
 * работало. С появлением гастропрогулок (/gastroguide/routes) под статьями
 * (/gastroguide) это правило зажигает ДВА пункта разом, и меню перестаёт
 * отвечать на вопрос «где я». Побеждает более длинный href — то же самое
 * правило самого точного совпадения, по которому выбирают маршрут роутеры.
 */

describe("активный пункт меню", () => {
  it("вложенный экран подсвечивает свой пункт, а не родительский", () => {
    // usePathname отдаёт путь БЕЗ query, поэтому карточка прогулки
    // (?route=<id>) — это тот же самый путь.
    expect(activeNavHref("/gastroguide/routes")).toBe("/gastroguide/routes");
  });

  it("экран без своего пункта подсвечивает ближайший родительский", () => {
    // У рубрик гастрогида пункта в меню нет — светится «Статьи».
    expect(activeNavHref("/gastroguide/categories")).toBe("/gastroguide");
    expect(activeNavHref("/gastroguide")).toBe("/gastroguide");
  });

  it("«/» — дашборд, а не префикс всего", () => {
    expect(activeNavHref("/")).toBe("/");
    expect(activeNavHref("/bookings")).toBe("/bookings");
  });

  it("незнакомый путь не подсвечивает ничего", () => {
    expect(activeNavHref("/nowhere")).toBeNull();
  });

  it("подсвеченный пункт всегда один — совпадений с одинаковой длиной не бывает", () => {
    const hrefs = NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("платформенные экраны", () => {
  it("гастропрогулки работают без выбранного заведения — это контент платформы", () => {
    expect(isPlatformRoute("/gastroguide/routes")).toBe(true);
  });
});
