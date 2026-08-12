import { beforeEach, describe, expect, it } from "vitest";
import type { MyRestaurant } from "@bookeat/api/admin";

import type { TokenStorage } from "../token-store";
import {
  RECENT_LIMIT,
  clearRecentVenues,
  filterVenues,
  readRecentVenueIds,
  recentVenues,
  rememberVenue,
} from "../venue-picking";
import { isPlatformRoute } from "../nav";

/**
 * A superadmin is staff at EVERY venue, so the venue list is a hundred rows
 * long. These are the two things that make it usable — search and a memory of
 * where the person actually works — and both must degrade quietly: a blocked
 * localStorage or a hand-edited value is "no history", never a panel that
 * cannot open.
 */

function memoryStorage(initial: Record<string, string> = {}): TokenStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function venue(id: string, name: string): MyRestaurant {
  return { id, name, role: "admin" } as MyRestaurant;
}

describe("filterVenues", () => {
  const list = [venue("1", "Mongol Bar"), venue("2", "Чайхана Палау"), venue("3", "Дёшево и вкусно")];

  it("пустой запрос — это не фильтр, а весь список", () => {
    expect(filterVenues(list, "")).toHaveLength(3);
    expect(filterVenues(list, "   ")).toHaveLength(3);
  });

  it("ищет по части названия и не зависит от регистра", () => {
    expect(filterVenues(list, "mongol").map((v) => v.id)).toEqual(["1"]);
    expect(filterVenues(list, "ЧАЙХАНА").map((v) => v.id)).toEqual(["2"]);
    expect(filterVenues(list, "хан").map((v) => v.id)).toEqual(["2"]);
  });

  it("«е» и «ё» — одна буква: заведение должно находиться при любом наборе", () => {
    expect(filterVenues(list, "дешево").map((v) => v.id)).toEqual(["3"]);
    expect(filterVenues(list, "дёшево").map((v) => v.id)).toEqual(["3"]);
  });

  it("ничего не нашлось — это пустой ответ, а не весь список", () => {
    expect(filterVenues(list, "суши")).toEqual([]);
  });
});

describe("память о недавних заведениях", () => {
  let storage: TokenStorage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("последнее выбранное встаёт первым, повторы схлопываются", () => {
    rememberVenue(storage, "a");
    rememberVenue(storage, "b");
    rememberVenue(storage, "a");
    expect(readRecentVenueIds(storage)).toEqual(["a", "b"]);
  });

  it("хранит не больше пяти — блок «недавние» не должен стать вторым списком", () => {
    for (const id of ["1", "2", "3", "4", "5", "6", "7"]) rememberVenue(storage, id);
    const got = readRecentVenueIds(storage);
    expect(got).toHaveLength(RECENT_LIMIT);
    expect(got[0]).toBe("7");
    expect(got).not.toContain("1");
  });

  it("испорченное значение читается как «истории нет», а не падением", () => {
    expect(readRecentVenueIds(memoryStorage({ "bookeat.admin.recent_restaurants": "{" }))).toEqual([]);
    expect(
      readRecentVenueIds(memoryStorage({ "bookeat.admin.recent_restaurants": '"строка"' })),
    ).toEqual([]);
    expect(readRecentVenueIds(null)).toEqual([]);
  });

  it("недоступное хранилище не ломает переключение заведения", () => {
    const blocked: TokenStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    expect(() => rememberVenue(blocked, "a")).not.toThrow();
    expect(() => clearRecentVenues(blocked)).not.toThrow();
  });

  it("выход из панели стирает историю — машина в ресторане общая", () => {
    rememberVenue(storage, "a");
    clearRecentVenues(storage);
    expect(readRecentVenueIds(storage)).toEqual([]);
  });
});

describe("recentVenues", () => {
  const list = [venue("a", "Abay"), venue("b", "Bidai"), venue("c", "Chaihana")];

  it("возвращает строки списка в порядке истории", () => {
    expect(recentVenues(list, ["c", "a"], null).map((v) => v.name)).toEqual(["Chaihana", "Abay"]);
  });

  it("выкидывает текущее заведение — ярлык на самого себя бесполезен", () => {
    expect(recentVenues(list, ["c", "a"], "c").map((v) => v.id)).toEqual(["a"]);
  });

  it("молча пропускает заведения, которыми человек больше не управляет", () => {
    expect(recentVenues(list, ["удалённое", "b"], null).map((v) => v.id)).toEqual(["b"]);
  });
});

describe("isPlatformRoute — какие экраны открываются без выбранного заведения", () => {
  it("разделы платформы — да, включая вложенные страницы", () => {
    expect(isPlatformRoute("/platform")).toBe(true);
    expect(isPlatformRoute("/venues")).toBe(true);
    expect(isPlatformRoute("/venues/123")).toBe(true);
    expect(isPlatformRoute("/gastroguide/categories")).toBe(true);
    expect(isPlatformRoute("/feed-moderation")).toBe(true);
  });

  it("экраны заведения — нет; «/» это сводка заведения, а не корень всего", () => {
    expect(isPlatformRoute("/")).toBe(false);
    expect(isPlatformRoute("/bookings")).toBe(false);
    expect(isPlatformRoute("/menu")).toBe(false);
    expect(isPlatformRoute("/settings")).toBe(false);
  });

  it("похожий по началу путь не считается разделом платформы", () => {
    expect(isPlatformRoute("/venues-report")).toBe(false);
  });
});
