import { useDetourContext } from "@swmansion/react-native-detour";
import { type ImperativeRouter, useRouter } from "expo-router";
import { useEffect } from "react";
import { trackEvent } from "./analytics";
import { writeCampaignAttribution } from "./campaign-attribution";
import { resolvePromoPathSegment, resolveSourcePathSegment } from "./detour-json-segment";
import { isKnownAppRoutePathname } from "./detour-known-routes";

type AppHref = Parameters<ImperativeRouter["replace"]>[0];

/**
 * Sibling of `ScreenViewTracker`/`AppUpdateGate`: renders nothing, sits next
 * to `<Stack />` inside `DetourProvider` (`app/_layout.tsx`), and only acts
 * on `useDetourContext()` changing.
 *
 * Detour's own Expo Router example gates the WHOLE app behind
 * `isLinkProcessed` (nothing renders until the deferred-link check
 * resolves). That does not fit here: `linkProcessingMode: "deferred-only"`
 * (see `src/lib/detour.ts`) means this only fires once per install, but
 * doing it as a blocking gate would add a network round-trip to every cold
 * start for our audience (RU/KZ, unreliable connections) even on the
 * 99% of opens that are not a deferred link. Instead we let the app render
 * immediately and redirect reactively once/if a deferred link resolves —
 * same end result (the link's route replaces whatever the guest would
 * otherwise land on), just non-blocking.
 *
 * `clearLink()` is mandatory after navigating: without it the SAME link
 * would re-trigger `router.replace` on every re-render of this effect's
 * dependencies (e.g. a subsequent unrelated navigation).
 *
 * CAMPAIGN ATTRIBUTION (Almaty Marathon and any QR/Detour promo after it):
 * `link.params`/`link.type` used to be read once for navigation and thrown
 * away right here — `clearLink()` ran with nothing durable written anywhere.
 * A guest who scans a QR code and books a table the next day (not the same
 * minute) would carry no trace of the campaign by the time they submit. Now
 * `writeCampaignAttribution` persists the tag (SecureStore, 30-day TTL —
 * see `campaign-attribution.ts`) BEFORE `clearLink()` runs, so it survives
 * past this one navigation; `useCampaignAttribution()` is how a later screen
 * (the booking confirm step) reads it back.
 *
 * JSON-SEGMENT LINKS (the QR-on-a-leaflet path, this campaign's MAIN
 * scenario): a fresh install resolves this link as a DEFERRED link, and for
 * links whose parameters are serialized as JSON in the URL's own trailing
 * path segment (see `detour-json-segment.ts`), `link.pathname` here is just
 * that raw JSON segment and `link.params` is empty — the SDK has nothing
 * else to parse it into. Code review on this branch (2026-09-14) caught that
 * the sibling fix for `app/+native-intent.tsx` (already-installed-app tap)
 * did NOT cover this deferred path, even though it's the one the marathon
 * QR campaign actually relies on. `resolvePromoPathSegment` below is the
 * same helper that fix uses, applied here too, so both entry points land on
 * `/promotion/<id>` and both write attribution.
 */
export function DetourLinkRouter(): null {
  const { isLinkProcessed, link, clearLink } = useDetourContext();
  const router = useRouter();

  useEffect(() => {
    if (!isLinkProcessed || !link) return;

    let cancelled = false;
    void (async () => {
      // `resolvePromoPathSegment` rewrites the raw-JSON-segment shape
      // (`link.pathname` is the JSON blob itself) into `/promotion/<id>` and
      // recovers the JSON's own fields (`promo`, and any extras) as params.
      // `null` means an ordinary link — keep `link.pathname`/`link.params`
      // as the SDK gave them, same as before this helper existed. Where a
      // key exists in BOTH, the link's own real query params win — they're
      // the more authoritative source, the JSON blob only exists as a
      // workaround for this one Detour dashboard link shape.
      const resolvedPromo = resolvePromoPathSegment(link.pathname);
      // CHANNEL-TAG CONTRACT (21.09.2026, `{"source":"tshirt"}`/`{"source":
      // "box"}`, `specs/marathon-qr-attribution-20260921.md`): same JSON-tail
      // shape as the promo link, but the destination is ALWAYS home — this
      // campaign no longer resolves a promo screen at all (§0 of the spec).
      // Only checked when there's no `promo` field — the old contract wins
      // if a link somehow carried both (regression safety, criterion 7).
      const resolvedSource = resolvedPromo ? null : resolveSourcePathSegment(link.pathname);
      // UNMATCHED-ROUTE GUARD (2026-09-21): when Detour resolves a deferred
      // link without a promo payload, `link.pathname` is normally a real
      // route already — but for a short link whose destination isn't
      // configured on Detour's side, the SDK can resolve it into a bare
      // custom-scheme URL and hand us the link's own shortcode as
      // `pathname` (e.g. "/lQ9BPpUvJc"), which matches no screen.
      // `router.replace`-ing straight to it surfaces Expo Router's
      // "Unmatched Route" instead of the ordinary home screen — mirrors
      // the `fallbackPath: ""` safety net `app/+native-intent.tsx` already
      // has for the sibling "tap while already installed" case (see
      // `detour-known-routes.ts` for why that mechanism doesn't cover this
      // path). Only applies when there's no recognized promo/source payload
      // — the branches above are untouched.
      const pathname = resolvedPromo
        ? resolvedPromo.pathname
        : resolvedSource
          ? resolvedSource.pathname
          : isKnownAppRoutePathname(link.pathname)
            ? link.pathname
            : "/";
      const params = resolvedPromo
        ? { ...resolvedPromo.params, ...link.params }
        : resolvedSource
          ? { ...resolvedSource.params, ...link.params }
          : link.params;

      const attribution = await writeCampaignAttribution({ url: link.url, params });
      if (cancelled) return;
      // Fires once per install (deferred-only mode resolves at most once) —
      // exactly the "first time we see this tag" moment, not on every app
      // open. `null` here means the link carried no recognizable promo UUID
      // (e.g. a plain deferred link with no campaign attached) — nothing to
      // report.
      if (attribution) {
        trackEvent("deep_link_attributed", {
          campaign_id: attribution.campaignId,
          link_type: link.type,
        });
      }

      router.replace({
        pathname,
        params: { fromDeepLink: "true", linkType: link.type, ...params },
      } as AppHref);
      clearLink();
    })();

    return () => {
      cancelled = true;
    };
  }, [isLinkProcessed, link, clearLink, router]);

  return null;
}
