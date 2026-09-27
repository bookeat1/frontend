import { type ImperativeRouter, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { writeCampaignAttribution } from "./campaign-attribution";
import { resolvePromoPathSegment, resolveSourcePathSegment } from "./detour-json-segment";

type AppHref = Parameters<ImperativeRouter["replace"]>[0];

/**
 * Mobile-web sibling of `DetourLinkRouter` (`detour-link-router.tsx`) /
 * `detour-native-intent-route.ts`.
 *
 * `DetourProviderGate` never mounts `<DetourProvider>` on `book-eat.com`'s
 * mobile-web export (no `EXPO_PUBLIC_DETOUR_API_KEY`/`EXPO_PUBLIC_DETOUR_APP_ID`
 * there on purpose — Detour is deferred-INSTALL attribution, meaningless in a
 * browser tab), so `DetourLinkRouter` never runs on that origin either. A
 * guest who opens `book-eat.com/...?promo=<uuid>` in a phone browser (the
 * "Almaty Marathon" QR/link flow, no app install involved) currently has no
 * code path that reads that query parameter at all — see
 * `deploy-mobile-web-prod.yml`'s comment on `EXPO_PUBLIC_MARATHON_PROMO_ID`
 * for the gap this closes.
 *
 * This component is that path, mirroring `apps/web/src/lib/campaign-attribution
 * .ts`'s `captureCampaignFromUrl` (same `?promo=` param name, read on every
 * page, idempotent — a later navigation without the param does not erase an
 * already-captured tag) but writing into the SAME storage location the native
 * Detour path writes into: `writeCampaignAttribution` → `SecureStore`, which
 * on `expo export --platform web` resolves to `secure-store.web.ts`'s
 * `localStorage`-backed implementation (Metro's platform-extension
 * resolution, see that file). `useCampaignAttribution()` (the booking confirm
 * screen's read side) is therefore unaware which platform wrote the tag.
 *
 * CHANNEL-TAG CONTRACT / JSON-TAIL SEGMENT (27.09.2026, «Марафон Алматы»,
 * t-shirt/box QR channels, `specs/marathon-qr-attribution-20260921.md`): the
 * two channel-tag Detour links resolve to a `{"source":"tshirt"}`/
 * `{"source":"box"}` payload serialized into the URL's own trailing path
 * segment (see `detour-json-segment.ts`'s module comment — confirmed live
 * against `resolve-short`), not a `?source=` query param. Native handles
 * this via `resolvePromoPathSegment`/`resolveSourcePathSegment` in
 * `DetourLinkRouter` and `detour-native-intent-route.ts`, but nothing
 * equivalent ran on the web export: a guest opening the box QR's web
 * fallback in a browser landed on `book-eat.com/%7B%22source%22%3A%22box%22%7D`
 * — a pathname that matches no screen — and saw Expo Router's "Unmatched
 * Route" instead of the home screen, with no attribution written at all.
 * This component now runs the SAME two resolvers (imported straight from
 * `detour-json-segment.ts`, which is pure JSON parsing with no native-module
 * import, safe in the web bundle) against `usePathname()`, and if either
 * matches, both writes the tag AND `router.replace`s to the resolved
 * pathname (always `/` for `source`, mirrors the native "channel tag never
 * opens a promo screen" rule) so the guest never sees the unmatched-route
 * dead end. `resolvePromoPathSegment` is tried first, same regression-safety
 * order as the native paths (spec criterion 7: a link that somehow carries
 * both fields keeps the OLD `promo` behavior).
 *
 * Mounted only on web at the call site in `app/_layout.tsx`
 * (`Platform.OS === "web"`, mirroring how `isDetourConfigured` gates
 * `<DetourLinkRouter />` there) — AND checks `Platform.OS` again inside its
 * own effect, the same double-gate `DetourProviderGate` uses for the native
 * retention-event call it cannot risk firing unconfigured: if this component
 * were ever mounted unconditionally by a future refactor, native attribution
 * must still stay exclusively Detour's job, not silently pick up a second
 * writer.
 *
 * `useGlobalSearchParams`, not `useLocalSearchParams`: this sits at the root
 * layout, above every screen, and must see the query string of whichever
 * route is currently focused, not just a param declared by that route's own
 * dynamic segment.
 */
export function WebPromoAttribution(): null {
  const params = useGlobalSearchParams<{
    promo?: string | string[];
    campaignId?: string | string[];
    campaign_id?: string | string[];
    source?: string | string[];
  }>();
  const pathname = usePathname();
  const router = useRouter();

  const promo = firstValue(params.promo);
  const campaignId = firstValue(params.campaignId);
  const campaignIdSnake = firstValue(params.campaign_id);
  const source = firstValue(params.source);

  // Guards against re-writing the identical tag on every re-render this
  // effect's own dependencies happen to produce (e.g. an unrelated
  // navigation that keeps the same query string) — not a correctness fix
  // (writeCampaignAttribution overwriting the same value is harmless), just
  // avoids a redundant localStorage write per navigation.
  const lastWritten = useRef<string | null>(null);
  // Guards the redirect the same way: without it, a resolved pathname that
  // `router.replace` cannot actually change (e.g. a test/host that keeps
  // reporting the same unmatched pathname) would re-fire every re-render.
  const lastRedirectedFrom = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Same JSON-tail path-segment shape the native Detour paths resolve
    // (`detour-json-segment.ts`) — `resolvePromoPathSegment` wins if a link
    // somehow carries both fields, matching the native regression-safety
    // order.
    const resolvedPromo = resolvePromoPathSegment(pathname);
    const resolvedSource = resolvedPromo ? null : resolveSourcePathSegment(pathname);
    const resolved = resolvedPromo ?? resolvedSource;

    const linkParams: Record<string, string> = { ...resolved?.params };
    if (promo !== undefined) linkParams.promo = promo;
    if (campaignId !== undefined) linkParams.campaignId = campaignId;
    if (campaignIdSnake !== undefined) linkParams.campaign_id = campaignIdSnake;
    if (source !== undefined) linkParams.source = source;

    if (resolved && resolved.pathname !== pathname && lastRedirectedFrom.current !== pathname) {
      lastRedirectedFrom.current = pathname;
      router.replace({ pathname: resolved.pathname, params: linkParams } as AppHref);
    }

    if (Object.keys(linkParams).length === 0) return;

    const cacheKey = JSON.stringify(linkParams);
    if (lastWritten.current === cacheKey) return;
    lastWritten.current = cacheKey;

    void writeCampaignAttribution({
      url: typeof window !== "undefined" ? window.location.href : "",
      params: linkParams,
    });
  }, [promo, campaignId, campaignIdSnake, source, pathname, router]);

  return null;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
