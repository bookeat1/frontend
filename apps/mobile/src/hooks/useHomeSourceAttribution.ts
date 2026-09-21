import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { writeCampaignAttribution } from "../lib/campaign-attribution";

/**
 * КАНАЛ-МЕТКА «приложение уже установлено» (21.09.2026, критерий 3,
 * `specs/marathon-qr-attribution-20260921.md`) — the home-screen twin of
 * `app/promotion/[id].tsx`'s own local `promo` effect, but for `source`.
 *
 * Tapping a Detour link whose JSON tail is `{"source":"tshirt"}` /
 * `{"source":"box"}` on an ALREADY-INSTALLED app
 * (`app/+native-intent.tsx` → `mapDetourResolvedUrlToRoute`, see
 * `detour-native-intent-route.ts`) routes straight HERE, `/`, with
 * `?source=<tag>` in the query — this campaign never resolves a promo
 * screen at all (spec §0). `DetourLinkRouter` (the FRESH-install, deferred
 * path) already writes the tag itself before navigating; this hook is only
 * for the second entry point, which has no writer component of its own —
 * the mapping step (`mapDetourResolvedUrlToRoute`) is a plain function, not
 * a component, so it cannot call `writeCampaignAttribution` itself.
 *
 * Mount once from `app/index.tsx` (the home screen, `/` route). A `ref`
 * guards against re-writing the identical tag on every re-render this
 * effect's own dependency happens to produce — same pattern
 * `WebPromoAttribution` and `[id].tsx`'s own effect use.
 */
export function useHomeSourceAttribution(): void {
  const { source: sourceParamRaw } = useLocalSearchParams<{ source?: string | string[] }>();
  const sourceParam = Array.isArray(sourceParamRaw) ? sourceParamRaw[0] : sourceParamRaw;
  const attributedSourceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sourceParam || attributedSourceRef.current === sourceParam) return;
    attributedSourceRef.current = sourceParam;
    void writeCampaignAttribution({
      url: `bookeat:///?source=${encodeURIComponent(sourceParam)}`,
      params: { source: sourceParam },
    });
  }, [sourceParam]);
}
