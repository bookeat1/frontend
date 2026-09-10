import { useDetourContext } from "@swmansion/react-native-detour";
import { type ImperativeRouter, useRouter } from "expo-router";
import { useEffect } from "react";
import { trackEvent } from "./analytics";
import { writeCampaignAttribution } from "./campaign-attribution";

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
 */
export function DetourLinkRouter(): null {
  const { isLinkProcessed, link, clearLink } = useDetourContext();
  const router = useRouter();

  useEffect(() => {
    if (!isLinkProcessed || !link) return;

    let cancelled = false;
    void (async () => {
      const attribution = await writeCampaignAttribution(link);
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
        pathname: link.pathname,
        params: { fromDeepLink: "true", linkType: link.type, ...link.params },
      } as AppHref);
      clearLink();
    })();

    return () => {
      cancelled = true;
    };
  }, [isLinkProcessed, link, clearLink, router]);

  return null;
}
