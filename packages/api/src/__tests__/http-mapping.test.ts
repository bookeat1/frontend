import { describe, expect, it } from "vitest";
import {
  MENU_HIGHLIGHT_LIMIT,
  mapMenuHighlights,
  mapRestaurantDetail,
  mapRestaurantSummary,
  mapSchedule,
  parsePriceMinor,
  priceLevelToPriceCategory,
  type ApiMenuItem,
  type ApiRestaurant,
} from "../http-mapping";

/**
 * REGRESSION GUARD — the mapper must not invent facts.
 *
 * Every case here is a thing the app actually showed a guest as true:
 * a distance nobody measured, dollars in a tenge product, a name with a
 * leading space that sorted the same venue into two places, and a menu that
 * was empty because a dish without a photo was filtered out (the live catalog
 * has ~350 dishes and zero photos).
 */

function apiRestaurant(overrides: Partial<ApiRestaurant> = {}): ApiRestaurant {
  return {
    id: "r-1",
    name: "Chaihana Palau",
    address: "пр. Достык 1",
    price_category: "₸₸",
    accepts_online_bookings: true,
    ...overrides,
  } as ApiRestaurant;
}

function apiDish(overrides: Partial<ApiMenuItem> = {}): ApiMenuItem {
  return {
    id: "d-1",
    name: "Плов",
    description: "",
    price: "5500.00",
    is_available: true,
    display_order: 1,
    ...overrides,
  } as ApiMenuItem;
}

describe("no invented distance", () => {
  it("neither the card nor the venue screen carries a distance field", () => {
    // The stub was a hash of the id rendered as «· 3.4 км». It was deleted
    // from the TYPES so it cannot come back quietly — assert on the object.
    const summary = mapRestaurantSummary(apiRestaurant());
    const detail = mapRestaurantDetail(apiRestaurant());
    for (const mapped of [summary, detail] as unknown as Record<string, unknown>[]) {
      expect(Object.keys(mapped)).not.toContain("distanceMeters");
      expect(Object.keys(mapped)).not.toContain("maxDistanceMeters");
      expect(mapped.distanceMeters).toBeUndefined();
    }
  });

  it("0,0 coordinates are absent, not the Gulf of Guinea", () => {
    const detail = mapRestaurantDetail(apiRestaurant({ latitude: 0, longitude: 0 }));
    expect(detail.latitude).toBeUndefined();
    expect(detail.longitude).toBeUndefined();
  });

  it("real coordinates are passed through", () => {
    const detail = mapRestaurantDetail(apiRestaurant({ latitude: 43.238, longitude: 76.945 }));
    expect(detail.latitude).toBeCloseTo(43.238);
  });
});

describe("prices are in tenge", () => {
  it("the price tier keeps the tenge alphabet, never dollars", () => {
    expect(mapRestaurantSummary(apiRestaurant({ price_category: "₸₸₸" })).priceLevel).toBe("₸₸₸");
    expect(mapRestaurantSummary(apiRestaurant({ price_category: "₸" })).priceLevel).toBe("₸");
    // Guard against a reintroduced re-expression into "$"/"$$"/"$$$".
    for (const tier of ["₸", "₸₸", "₸₸₸", "₸₸₸₸"]) {
      expect(mapRestaurantSummary(apiRestaurant({ price_category: tier })).priceLevel).not.toContain(
        "$",
      );
    }
  });

  it("the filter sends back exactly what the server compares against", () => {
    expect(priceLevelToPriceCategory("₸₸₸")).toBe("₸₸₸");
  });

  it("a dish price is formatted as grouped tenge", () => {
    const [dish] = mapMenuHighlights([apiDish({ price: "5500.00" })], 8);
    expect(dish.price).toMatch(/₸$/);
    expect(dish.price).not.toContain("$");
    expect(dish.price.replace(/\s/g, "")).toBe("5500₸");
  });

  it("an ABSENT price is unknown, not 0 ₸ — a free dish is a lie", () => {
    const [dish] = mapMenuHighlights([apiDish({ price: "" })], 8);
    expect(dish.price).toBe("");
    expect(dish.price).not.toContain("0");
    expect(parsePriceMinor("")).toBeNull();
    expect(parsePriceMinor(null)).toBeNull();
  });

  it("a decimal price becomes exact minor units, with no float dust", () => {
    // "3510.00" * 100 in floating point is 351000.00000000006.
    expect(parsePriceMinor("3510.00")).toBe(351_000);
    expect(parsePriceMinor("5500.00")).toBe(550_000);
  });
});

describe("names are trimmed at the one seam", () => {
  it.each([
    [" Chaihana Palau  ", "Chaihana Palau"],
    ["Koktobe Terrace  ", "Koktobe Terrace"],
    ["Hooqa Room ", "Hooqa Room"],
  ])("%j → %j", (raw, expected) => {
    // Real values from the live catalog (verified by curl 2026-07-26): the
    // same venue used to sit a few pixels apart on two screens and sort into
    // a different place, because one screen trimmed by hand and the other
    // did not.
    expect(mapRestaurantSummary(apiRestaurant({ name: raw })).name).toBe(expected);
    expect(mapRestaurantDetail(apiRestaurant({ name: raw })).name).toBe(expected);
  });

  it("the address is trimmed too", () => {
    expect(mapRestaurantSummary(apiRestaurant({ address: "  пр. Достык 1 " })).address).toBe(
      "пр. Достык 1",
    );
  });
});

describe("a dish without a photo is still on the menu", () => {
  it("shows dishes with no image_url at all", () => {
    // The whole live catalog is like this: ~350 dishes, zero photos. Filtering
    // on the photo emptied «Популярное в меню» for every venue.
    const dishes = mapMenuHighlights(
      [apiDish({ id: "d-1", name: "Плов" }), apiDish({ id: "d-2", name: "Лагман", image_url: "" })],
      8,
    );
    expect(dishes.map((d) => d.name)).toEqual(["Плов", "Лагман"]);
    expect(dishes.every((d) => d.photo === undefined)).toBe(true);
  });

  it("a photo-less dish gets NO placeholder image — undefined, so the card can be honest", () => {
    const [dish] = mapMenuHighlights([apiDish()], 8);
    expect(dish.photo).toBeUndefined();
  });

  it("an unavailable dish is still hidden — that IS a fact from the server", () => {
    const dishes = mapMenuHighlights(
      [apiDish({ id: "d-1" }), apiDish({ id: "d-2", is_available: false })],
      8,
    );
    expect(dishes).toHaveLength(1);
  });

  it("keeps the venue's own display_order and cuts at the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      apiDish({ id: `d-${i}`, name: `Блюдо ${i}`, display_order: 20 - i }),
    );
    const dishes = mapMenuHighlights(many, MENU_HIGHLIGHT_LIMIT);
    expect(dishes).toHaveLength(MENU_HIGHLIGHT_LIMIT);
    expect(dishes[0].name).toBe("Блюдо 19");
  });

  it("survives a null menu (the side-request failed)", () => {
    expect(mapMenuHighlights(null, 8)).toEqual([]);
    expect(mapMenuHighlights(undefined, 8)).toEqual([]);
  });
});

describe("HTML from the old CMS never reaches the guest as tags", () => {
  it("strips markup and entities out of the description", () => {
    const detail = mapRestaurantDetail(
      apiRestaurant({
        description: '<p><span style="color: rgb(84,84,84);">Уютное&nbsp;место</span></p>',
      }),
    );
    expect(detail.description).toBe("Уютное место");
    expect(detail.description).not.toContain("<");
    expect(detail.description).not.toContain("&nbsp;");
  });
});

describe("mapSchedule reports what the server said and nothing more", () => {
  it("a missing schedule is null — unknown, never closed", () => {
    expect(mapSchedule(undefined)).toBeNull();
    expect(mapSchedule(null)).toBeNull();
    expect(mapRestaurantSummary(apiRestaurant()).schedule).toBeNull();
  });

  it("a missing open_now stays null instead of collapsing to false", () => {
    const schedule = mapSchedule({ timezone: "Asia/Almaty", days: [] } as never);
    expect(schedule?.openNow).toBeNull();
  });

  it("a day off has no times — an empty string is not 00:00", () => {
    const schedule = mapSchedule({
      timezone: "Asia/Almaty",
      open_now: false,
      days: [{ day_of_week: 1, is_open: false, opens_at: "", closes_at: "", closes_next_day: false }],
    });
    expect(schedule?.days[0]).toEqual({
      dayOfWeek: 1,
      isOpen: false,
      opensAt: null,
      closesAt: null,
      closesNextDay: false,
    });
  });

  it("keeps closes_next_day, so 12:00–01:00 is thirteen hours and not one", () => {
    const schedule = mapSchedule({
      timezone: "Asia/Almaty",
      open_now: true,
      days: [
        { day_of_week: 4, is_open: true, opens_at: "12:00", closes_at: "01:00", closes_next_day: true },
      ],
    });
    expect(schedule?.days[0].closesNextDay).toBe(true);
  });

  it("free-text opening hours NEVER produce a schedule, however open they read", () => {
    // Half of the «Открыто сейчас» bug lived here: the client used to parse
    // the first and last "HH:MM" out of this string. These are real live
    // values (verified by curl 2026-07-26). The string is carried through for
    // display, verbatim — it decides nothing.
    for (const hours of [
      "Пн — Чт: 12:00–01:00, Пт — Сб: 12:00–03:00, Вc: 12:00–01:00",
      "Чт, Пт, Сб 19:00-24:00",
      "Ежедневно 00:00-23:59, круглосуточно",
      "по звонку",
    ]) {
      const detail = mapRestaurantDetail(apiRestaurant({ opening_hours: hours }));
      expect(detail.schedule, hours).toBeNull();
      expect(detail.openingHoursText).toBe(hours);
      expect(mapRestaurantSummary(apiRestaurant({ opening_hours: hours })).schedule).toBeNull();
    }
  });

  it("accepts_online_bookings is read as a fact, and absence means 'no'", () => {
    expect(mapRestaurantSummary(apiRestaurant()).acceptsOnlineBookings).toBe(true);
    expect(
      mapRestaurantSummary(apiRestaurant({ accepts_online_bookings: undefined })).acceptsOnlineBookings,
    ).toBe(false);
  });
});
