import { useGlobalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { writeCampaignAttribution } from "./campaign-attribution";

/**
 * Mobile-web sibling of `DetourLinkRouter` (`detour-link-router.tsx`).
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
  }>();

  const promo = firstValue(params.promo);
  const campaignId = firstValue(params.campaignId);
  const campaignIdSnake = firstValue(params.campaign_id);

  // Guards against re-writing the identical tag on every re-render this
  // effect's own dependencies happen to produce (e.g. an unrelated
  // navigation that keeps the same query string) — not a correctness fix
  // (writeCampaignAttribution overwriting the same value is harmless), just
  // avoids a redundant localStorage write per navigation.
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const linkParams: Record<string, string> = {};
    if (promo !== undefined) linkParams.promo = promo;
    if (campaignId !== undefined) linkParams.campaignId = campaignId;
    if (campaignIdSnake !== undefined) linkParams.campaign_id = campaignIdSnake;
    if (Object.keys(linkParams).length === 0) return;

    const cacheKey = JSON.stringify(linkParams);
    if (lastWritten.current === cacheKey) return;
    lastWritten.current = cacheKey;

    void writeCampaignAttribution({
      url: typeof window !== "undefined" ? window.location.href : "",
      params: linkParams,
    });
  }, [promo, campaignId, campaignIdSnake]);

  return null;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
