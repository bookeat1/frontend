import { describe, expect, it } from "vitest";
import type { SearchResult } from "@bookeat/api/client";

import { venueDetail, venueSummary } from "@web/test/harness";
import { siteUrl } from "@web/lib/site";
import { catalogMetadata, homeMetadata, pageMetadata, venueMetadata } from "@web/lib/seo/metadata";

function asString(value: unknown): string {
  expect(typeof value).toBe("string");
  return value as string;
}

describe("venueMetadata", () => {
  it("builds a unique title, a fact-based description and a canonical without query", () => {
    const venue = venueDetail({
      id: "venue-1",
      name: "Local Coffee",
      city: "Алматы",
      address: "ул. Достык, 91",
      cuisines: [{ id: "european", name: "Европейская" }],
      priceLevel: "₸₸₸",
      description: "Уютная кофейня с завтраками весь день.",
    });
    const meta = venueMetadata(venue);
    const title = asString(meta.title);
    expect(title).toBe("Local Coffee, Алматы: забронировать столик");
    expect(title.length).toBeLessThanOrEqual(70);

    const description = asString(meta.description);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain("Европейская");
    expect(description).toContain("ул. Достык, 91");

    expect(meta.alternates?.canonical).toBe(`${siteUrl}/venues/venue-1`);
    expect(meta.openGraph?.url).toBe(`${siteUrl}/venues/venue-1`);
    expect(meta.openGraph?.locale).toBe("ru_RU");
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("truncates a long name by the NAME, not by dropping the city (B-14)", () => {
    const venue = venueDetail({
      id: "venue-2",
      name: "Очень длинное название заведения, которое точно длиннее семидесяти символов подряд",
      city: "Алматы",
    });
    const title = asString(venueMetadata(venue).title);
    expect(title.length).toBeLessThanOrEqual(70);
    expect(title).toMatch(/, Алматы: забронировать столик$/);
  });

  it("falls back to the free-text schedule when there is no structured one", () => {
    const venue = venueDetail({ schedule: null, openingHoursText: "Пн-Вс с 10:00 до 23:00" });
    const description = asString(venueMetadata(venue).description);
    expect(description).toContain("Пн-Вс с 10:00 до 23:00");
  });
});

describe("catalogMetadata", () => {
  it("describes the listing from real counts and cuisines, not a slogan", () => {
    const result: SearchResult = {
      query: { text: "", filters: {} as SearchResult["query"]["filters"] },
      total: 22,
      items: [
        venueSummary({ cuisines: [{ id: "georgian", name: "Грузинская" }] }),
        venueSummary({ id: "v2", cuisines: [{ id: "european", name: "Европейская" }] }),
      ],
    };
    const meta = catalogMetadata(result);
    expect(asString(meta.title)).toBe("Рестораны и кафе Алматы: бронирование столиков онлайн");
    const description = asString(meta.description);
    expect(description).toContain("22");
    expect(description).toMatch(/Грузинская|Европейская/);
    expect(meta.alternates?.canonical).toBe(`${siteUrl}/venues`);
  });

  it("does not invent facts when the SSR search failed (A-9: no cached emptiness)", () => {
    const meta = catalogMetadata(null);
    expect(asString(meta.description).length).toBeGreaterThan(0);
  });
});

describe("homeMetadata", () => {
  it("uses the real venue count for the given city", () => {
    const result: SearchResult = {
      query: { text: "", filters: {} as SearchResult["query"]["filters"] },
      total: 22,
      items: [venueSummary()],
    };
    const meta = homeMetadata(result, "Алматы");
    expect(asString(meta.title)).toBe("Бронирование столиков в ресторанах и кафе Алматы онлайн");
    expect(asString(meta.description)).toContain("22");
    expect(meta.alternates?.canonical).toBe(`${siteUrl}/`);
  });
});

describe("pageMetadata", () => {
  it("uses the CMS title/body when the server fetch succeeded", () => {
    const meta = pageMetadata("about", { slug: "about", title: "О BookEat", body: "# Кто мы\nBookEat — сервис бронирования столиков." });
    expect(asString(meta.title)).toBe("О BookEat");
    expect(asString(meta.description)).toContain("BookEat");
    expect(meta.alternates?.canonical).toBe(`${siteUrl}/about`);
  });

  it("falls back to the dictionary tab title when the server fetch failed", () => {
    const meta = pageMetadata("privacy", null);
    expect(asString(meta.title)).toBe("Политика данных");
  });
});
