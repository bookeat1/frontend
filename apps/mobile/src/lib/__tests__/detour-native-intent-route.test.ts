import { describe, expect, it } from "vitest";
import { mapDetourResolvedUrlToRoute } from "../detour-native-intent-route";

/**
 * `app/+native-intent.tsx` is a special Expo Router file (route
 * conventions, not just a normal module) — the `mapToRoute` logic lives in
 * this plain lib file so it can be unit-tested directly, same pattern as
 * `campaign-attribution.ts` / `detour-link-router.tsx`.
 *
 * Regression covered here: tapping the Almaty Marathon promo link
 * (`https://bookeat.godetour.link/lQ9BPpUvJc00ughb`) on an already-installed
 * app landed on Expo Router's "Unmatched Route" instead of the promo screen
 * (live on iOS, 2026-09-14) because Detour's `resolve-short` response
 * encodes this link's parameters (`{"promo":"<uuid>"}`) as the URL's own
 * trailing path segment, and the SDK's default `mapToRoute` just drops the
 * first segment and routes to whatever's left — here, the raw JSON.
 */

const PROMO_UUID = "6a3736b9-d4e5-4ec6-9ed2-7233476184fd";

const resolvedValue = (url: string) => ({
  resolvedUrl: new URL(url),
  originalPath: url,
  initial: false,
});

describe("mapDetourResolvedUrlToRoute", () => {
  it("routes a promo link (JSON parameters as the last path segment) to /promotion/<id>", () => {
    const encoded = encodeURIComponent(JSON.stringify({ promo: PROMO_UUID }));
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc00ughb/${encoded}`),
    );

    expect(route).toBe(`/promotion/${PROMO_UUID}`);
  });

  it("forwards other JSON fields as a query string, without dropping promo", () => {
    const encoded = encodeURIComponent(
      JSON.stringify({ promo: PROMO_UUID, utm_content: "stand" }),
    );
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc00ughb/${encoded}`),
    );

    expect(route).toBe(`/promotion/${PROMO_UUID}?utm_content=stand`);
  });

  it("ignores a JSON payload with no promo field and falls back to default routing", () => {
    const encoded = encodeURIComponent(JSON.stringify({ utm_content: "stand" }));
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc00ughb/${encoded}`),
    );

    // Default behavior: drop the first (app-hash) segment, keep the rest.
    expect(route).toBe(`/${encoded}`);
  });

  it("leaves an ordinary (non-JSON) resolved link on the SDK's default drop-first-segment route", () => {
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue("https://bookeat.godetour.link/abcd1234/restaurant/r-1"),
    );

    expect(route).toBe("/restaurant/r-1");
  });

  it("keeps a single-segment resolved link's own path (no app-hash to drop)", () => {
    const route = mapDetourResolvedUrlToRoute(resolvedValue("https://bookeat.godetour.link/details"));

    expect(route).toBe("/details");
  });

  it("preserves the query string on a non-JSON resolved link", () => {
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue("https://bookeat.godetour.link/abcd1234/promotions?utm_source=qr"),
    );

    expect(route).toBe("/promotions?utm_source=qr");
  });

  it("routes a custom-scheme resolved link (bookeat://) like the SDK's default", () => {
    const route = mapDetourResolvedUrlToRoute(resolvedValue("bookeat://promo/MARATHON?utm_source=qr"));

    expect(route).toBe("/promo/MARATHON?utm_source=qr");
  });
});
