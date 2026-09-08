import { describe, expect, it } from "vitest";

import { absoluteUrl } from "@web/lib/site";
import {
  buildSitemapEntries,
  EMPTY_SOURCES,
  PUBLIC_STATIC_ROUTES,
  ROBOTS_DISALLOW,
} from "@web/lib/sitemap-entries";

const BASE = "https://book-eat.com";

describe("absoluteUrl", () => {
  it("joins the base and the path without a double slash", () => {
    expect(absoluteUrl("/venues", BASE)).toBe("https://book-eat.com/venues");
    expect(absoluteUrl("/", BASE)).toBe("https://book-eat.com/");
  });

  it("keeps a basePath that lives inside the site URL (test stand)", () => {
    expect(absoluteUrl("/venues", "https://test.backend.book-eat.com/web-preview")).toBe(
      "https://test.backend.book-eat.com/web-preview/venues",
    );
  });

  it("refuses a relative path — a sitemap with relative URLs is worthless", () => {
    expect(() => absoluteUrl("venues", BASE)).toThrow(/starting with/);
  });
});

describe("buildSitemapEntries", () => {
  it("lists every public static route exactly once, home first", () => {
    const urls = buildSitemapEntries(EMPTY_SOURCES, BASE).map((e) => e.url);
    expect(urls[0]).toBe("https://book-eat.com/");
    expect(urls).toHaveLength(PUBLIC_STATIC_ROUTES.length);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("never advertises what robots.txt forbids", () => {
    const urls = buildSitemapEntries(
      { venueIds: ["v1"], eventIds: ["e1"], articleSlugs: ["s1"] },
      BASE,
    ).map((e) => e.url);
    for (const rule of ROBOTS_DISALLOW) {
      // `*` matches any run of path segments, same as robots.txt's own wildcard —
      // a naive prefix check would also flag legit URLs like /venues/:id for the
      // rule /venues/*/book, since that literal prefix is /venues/.
      const pattern = new RegExp(
        `^${rule
          .split("*")
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*")}`,
      );
      expect(urls.some((u) => pattern.test(u.slice(BASE.length))), rule).toBe(false);
    }
  });

  it("adds a venue page and its menu per venue, dedupes ids and encodes them", () => {
    const urls = buildSitemapEntries(
      { venueIds: ["abc", "abc", " ", "with space"], eventIds: [], articleSlugs: [] },
      BASE,
    ).map((e) => e.url);
    const venueUrls = urls.filter((u) => u.includes("/venues/"));
    expect(venueUrls).toEqual([
      "https://book-eat.com/venues/abc",
      "https://book-eat.com/venues/abc/menu",
      "https://book-eat.com/venues/with%20space",
      "https://book-eat.com/venues/with%20space/menu",
    ]);
  });

  it("adds events and articles", () => {
    const urls = buildSitemapEntries(
      { venueIds: [], eventIds: ["ev-1"], articleSlugs: ["kak-vybrat-vino"] },
      BASE,
    ).map((e) => e.url);
    expect(urls).toContain("https://book-eat.com/events/ev-1");
    expect(urls).toContain("https://book-eat.com/articles/kak-vybrat-vino");
  });
});
