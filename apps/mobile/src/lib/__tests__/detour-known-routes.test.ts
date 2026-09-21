import { describe, expect, it } from "vitest";
import { isKnownAppRoutePathname } from "../detour-known-routes";

describe("isKnownAppRoutePathname", () => {
  it("accepts the home route", () => {
    expect(isKnownAppRoutePathname("/")).toBe(true);
    expect(isKnownAppRoutePathname("")).toBe(true);
  });

  it("accepts real top-level app routes, with or without a nested/dynamic segment", () => {
    expect(isKnownAppRoutePathname("/promotions")).toBe(true);
    expect(isKnownAppRoutePathname("/promotion/6a3736b9-d4e5-4ec6-9ed2-7233476184fd")).toBe(true);
    expect(isKnownAppRoutePathname("/restaurant/r-1")).toBe(true);
    expect(isKnownAppRoutePathname("/booking/b-1")).toBe(true);
  });

  it("rejects a raw Detour shortcode (the actual bug: unresolved deferred link)", () => {
    expect(isKnownAppRoutePathname("/lQ9BPpUvJc")).toBe(false);
  });

  it("rejects a raw JSON path segment that isn't the recognized promo shape", () => {
    expect(isKnownAppRoutePathname(`/${encodeURIComponent(JSON.stringify({ utm_content: "x" }))}`)).toBe(
      false,
    );
  });
});
