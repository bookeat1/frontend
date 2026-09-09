import { useDetourContext } from "@swmansion/react-native-detour";
import { type ImperativeRouter, useRouter } from "expo-router";
import { useEffect } from "react";

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
 */
export function DetourLinkRouter(): null {
  const { isLinkProcessed, link, clearLink } = useDetourContext();
  const router = useRouter();

  useEffect(() => {
    if (!isLinkProcessed || !link) return;

    router.replace({
      pathname: link.pathname,
      params: { fromDeepLink: "true", linkType: link.type, ...link.params },
    } as AppHref);
    clearLink();
  }, [isLinkProcessed, link, clearLink, router]);

  return null;
}
