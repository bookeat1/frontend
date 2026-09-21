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
  it("routes a promo link (JSON parameters as the last path segment) to /promotion/<id>, keeping promo in the query", () => {
    const encoded = encodeURIComponent(JSON.stringify({ promo: PROMO_UUID }));
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc00ughb/${encoded}`),
    );

    expect(route).toBe(`/promotion/${PROMO_UUID}?promo=${PROMO_UUID}`);
  });

  it("forwards other JSON fields as a query string, alongside promo", () => {
    const encoded = encodeURIComponent(
      JSON.stringify({ promo: PROMO_UUID, utm_content: "stand" }),
    );
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc00ughb/${encoded}`),
    );

    expect(route).toBe(`/promotion/${PROMO_UUID}?promo=${PROMO_UUID}&utm_content=stand`);
  });

  it("preserves the resolved URL's own query string on the promo branch too (not just the default branch)", () => {
    const encoded = encodeURIComponent(JSON.stringify({ promo: PROMO_UUID }));
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc00ughb/${encoded}?utm_source=qr`),
    );

    expect(route).toBe(`/promotion/${PROMO_UUID}?promo=${PROMO_UUID}&utm_source=qr`);
  });

  it("ignores a JSON payload with no promo field and falls back to the home route (not a real route)", () => {
    const encoded = encodeURIComponent(JSON.stringify({ utm_content: "stand" }));
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc00ughb/${encoded}`),
    );

    // Default behavior drops the first (app-hash) segment; what's left is a
    // raw JSON blob, which is not a real app route — the UNMATCHED-ROUTE
    // GUARD (2026-09-21) sends it to "/" instead of Unmatched Route.
    expect(route).toBe("/");
  });

  it("leaves an ordinary (non-JSON) resolved link on the SDK's default drop-first-segment route", () => {
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue("https://bookeat.godetour.link/abcd1234/restaurant/r-1"),
    );

    expect(route).toBe("/restaurant/r-1");
  });

  it("keeps a single-segment resolved link's own path when it is a known route (no app-hash to drop)", () => {
    const route = mapDetourResolvedUrlToRoute(resolvedValue("https://bookeat.godetour.link/settings"));

    expect(route).toBe("/settings");
  });

  it("UNMATCHED-ROUTE GUARD: a single-segment resolved link that is NOT a known route falls back to home", () => {
    // Same shape as a Detour short-link shortcode with no destination
    // configured on the dashboard (e.g. "/lQ9BPpUvJc") — confirmed live,
    // tapping such a link on an already-installed app used to land on
    // Expo Router's "Unmatched Route".
    const route = mapDetourResolvedUrlToRoute(resolvedValue("https://bookeat.godetour.link/lQ9BPpUvJc"));

    expect(route).toBe("/");
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

/**
 * Edge cases beyond the happy path. The first one is the EXACT `link` value
 * Detour's `resolve-short` returned for the marathon short link on
 * 2026-09-14 (verified by a direct API call): note the `:` between key and
 * value is NOT percent-encoded, unlike what `encodeURIComponent` produces,
 * so the tests above never exercised the real payload.
 */
describe("mapDetourResolvedUrlToRoute — edge cases", () => {
  const LIVE_MARATHON_LINK =
    "https://bookeat.godetour.link/lQ9BPpUvJc/%7B%22promo%22:%226a3736b9-d4e5-4ec6-9ed2-7233476184fd%22%7D";

  it("routes the exact live resolve-short payload (unencoded ':' inside the JSON segment)", () => {
    expect(mapDetourResolvedUrlToRoute(resolvedValue(LIVE_MARATHON_LINK))).toBe(
      `/promotion/${PROMO_UUID}?promo=${PROMO_UUID}`,
    );
  });

  it("falls back to the home route on an empty JSON object (not a real route)", () => {
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue("https://bookeat.godetour.link/lQ9BPpUvJc/%7B%7D"),
    );

    expect(route).toBe("/");
  });

  it("does not throw on a malformed percent-encoding in the last segment; falls back to home", () => {
    // `%E0%A4%A` is a truncated UTF-8 sequence: decodeURIComponent throws URIError.
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue("https://bookeat.godetour.link/lQ9BPpUvJc/%7B%22promo%22%3A%E0%A4%A"),
    );

    expect(route).toBe("/");
  });

  it("falls back to home when promo is not a non-empty string (number, empty string, array payload)", () => {
    const numeric = encodeURIComponent(JSON.stringify({ promo: 123 }));
    const empty = encodeURIComponent(JSON.stringify({ promo: "" }));
    const array = encodeURIComponent(JSON.stringify([{ promo: PROMO_UUID }]));

    expect(mapDetourResolvedUrlToRoute(resolvedValue(`https://x.godetour.link/h/${numeric}`))).toBe("/");
    expect(mapDetourResolvedUrlToRoute(resolvedValue(`https://x.godetour.link/h/${empty}`))).toBe("/");
    expect(mapDetourResolvedUrlToRoute(resolvedValue(`https://x.godetour.link/h/${array}`))).toBe("/");
  });

  it("only inspects the LAST segment: JSON in the middle is not a known route, falls back to home", () => {
    const encoded = encodeURIComponent(JSON.stringify({ promo: PROMO_UUID }));
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc/${encoded}/extra`),
    );

    expect(route).toBe("/");
  });

  it("still routes to /promotion/<id> when there are several segments before the JSON one", () => {
    const encoded = encodeURIComponent(JSON.stringify({ promo: PROMO_UUID }));
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc/promotion/${encoded}/`),
    );

    expect(route).toBe(`/promotion/${PROMO_UUID}?promo=${PROMO_UUID}`);
  });

  it("percent-encodes non-ASCII keys/values and skips nested values when forwarding extras", () => {
    const encoded = encodeURIComponent(
      JSON.stringify({ promo: PROMO_UUID, место: "стенд у финиша", nested: { a: 1 }, list: [1] }),
    );
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc/${encoded}`),
    );

    expect(route).toBe(
      `/promotion/${PROMO_UUID}?promo=${PROMO_UUID}&${encodeURIComponent("место")}=${encodeURIComponent("стенд у финиша")}`,
    );
  });

  it("percent-encodes a promo id that is not a plain UUID so it stays a single path segment", () => {
    const encoded = encodeURIComponent(JSON.stringify({ promo: "a b/c?d" }));
    const route = mapDetourResolvedUrlToRoute(
      resolvedValue(`https://bookeat.godetour.link/lQ9BPpUvJc/${encoded}`),
    );

    expect(route).toBe("/promotion/a%20b%2Fc%3Fd?promo=a%20b%2Fc%3Fd");
  });
});
