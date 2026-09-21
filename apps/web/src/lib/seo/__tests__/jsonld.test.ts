import { describe, expect, it } from "vitest";

import { venueDetail } from "@web/test/harness";
import { siteUrl } from "@web/lib/site";
import {
  breadcrumbJsonLd,
  graph,
  itemListJsonLd,
  normalizePhoneForJsonLd,
  organizationGraph,
  restaurantJsonLd,
} from "@web/lib/seo/jsonld";

describe("organizationGraph", () => {
  it("carries Organization and WebSite, no legalName (owner decision 🟡2 is undecided)", () => {
    const nodes = organizationGraph();
    const org = nodes.find((n) => n["@type"] === "Organization");
    const site = nodes.find((n) => n["@type"] === "WebSite");
    expect(org).toMatchObject({ name: "BookEat", url: siteUrl, logo: `${siteUrl}/apple-icon.png` });
    expect(org).not.toHaveProperty("legalName");
    expect(site).toMatchObject({
      url: siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/venues?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    });
  });

  it("graph() wraps nodes in a single @context/@graph document that JSON.parse can read back", () => {
    const parsed = JSON.parse(JSON.stringify(graph(organizationGraph())));
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"]).toHaveLength(2);
  });
});

describe("normalizePhoneForJsonLd", () => {
  it("turns a leading 8 into +7", () => {
    expect(normalizePhoneForJsonLd("8 (747) 944 4626")).toBe("+77479444626");
  });

  it("keeps a leading 7 as-is, with +", () => {
    expect(normalizePhoneForJsonLd("+7 747 944 4626")).toBe("+77479444626");
  });

  it("prepends +7 to a bare 10-digit local number", () => {
    expect(normalizePhoneForJsonLd("747 944 4626")).toBe("+77479444626");
  });

  it("omits a number that doesn't look Kazakhstani rather than guessing", () => {
    expect(normalizePhoneForJsonLd("12345")).toBeUndefined();
    expect(normalizePhoneForJsonLd(undefined)).toBeUndefined();
  });
});

describe("restaurantJsonLd", () => {
  it("carries the required facts and the canonical URL", () => {
    const venue = venueDetail({
      id: "venue-1",
      name: "Local Coffee",
      city: "Алматы",
      address: "ул. Достык, 91",
      cuisines: [{ id: "european", name: "Европейская" }],
      priceLevel: "₸₸₸",
    });
    const node = restaurantJsonLd(venue);
    expect(node).toMatchObject({
      "@type": "Restaurant",
      name: "Local Coffee",
      url: `${siteUrl}/venues/venue-1`,
      address: { "@type": "PostalAddress", streetAddress: "ул. Достык, 91", addressLocality: "Алматы", addressCountry: "KZ" },
      servesCuisine: ["Европейская"],
      priceRange: "₸₸₸",
    });
  });

  it("omits geo, hasMenu and aggregateRating when the data isn't there (14/22, 0/22 reviews on prod)", () => {
    const venue = venueDetail({ latitude: undefined, longitude: undefined, reviewsCount: 0 });
    const node = restaurantJsonLd(venue);
    expect(node).not.toHaveProperty("geo");
    expect(node).not.toHaveProperty("hasMenu");
    expect(node).not.toHaveProperty("aggregateRating");
  });

  it("adds geo only when BOTH coordinates are present", () => {
    const venue = venueDetail({ latitude: 43.2, longitude: 76.9 });
    const node = restaurantJsonLd(venue);
    expect(node.geo).toEqual({ "@type": "GeoCoordinates", latitude: 43.2, longitude: 76.9 });
  });

  it("adds aggregateRating only when reviewsCount > 0 (critical: never a rating with count 0)", () => {
    const venue = venueDetail({ reviewsCount: 5, rating: 4.5 });
    const node = restaurantJsonLd(venue);
    expect(node.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      reviewCount: 5,
      bestRating: 5,
    });
  });

  it("acceptsReservations is the booking URL when the venue takes online bookings, else false", () => {
    const bookable = venueDetail({ id: "v1", acceptsOnlineBookings: true });
    const notBookable = venueDetail({ id: "v2", acceptsOnlineBookings: false });
    expect(restaurantJsonLd(bookable).acceptsReservations).toBe(`${siteUrl}/venues/v1/book`);
    expect(restaurantJsonLd(notBookable).acceptsReservations).toBe(false);
  });

  it("only lists opening hours for days the server said are open", () => {
    const venue = venueDetail({
      schedule: {
        timezone: "Asia/Almaty",
        openNow: true,
        days: [
          { dayOfWeek: 1, isOpen: true, opensAt: "10:00", closesAt: "23:00", closesNextDay: false },
          { dayOfWeek: 2, isOpen: false, opensAt: null, closesAt: null, closesNextDay: false },
        ],
      },
    });
    const hours = restaurantJsonLd(venue).openingHoursSpecification as Array<Record<string, unknown>>;
    expect(hours).toHaveLength(1);
    expect(hours[0]).toMatchObject({ dayOfWeek: "https://schema.org/Monday", opens: "10:00", closes: "23:00" });
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers items from 1 and only adds `item` when a path is given", () => {
    const node = breadcrumbJsonLd([
      { name: "Главная", path: "/" },
      { name: "Алматы" },
      { name: "Заведения", path: "/venues" },
    ]);
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items[0]).toMatchObject({ position: 1, name: "Главная", item: `${siteUrl}/` });
    expect(items[1]).toEqual({ "@type": "ListItem", position: 2, name: "Алматы" });
  });
});

describe("itemListJsonLd", () => {
  it("builds one ListItem per entry with an absolute URL", () => {
    const node = itemListJsonLd(
      [
        { id: "v1", name: "Local Coffee" },
        { id: "v2", name: "Ocean Basket" },
      ],
      (id) => `/venues/${id}`,
    );
    const items = node.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[1]).toEqual({ "@type": "ListItem", position: 2, name: "Ocean Basket", url: `${siteUrl}/venues/v2` });
  });
});
