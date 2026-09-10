import { useEffect, useState } from "react";
import { readCampaignAttribution, type CampaignAttribution } from "../lib/campaign-attribution";

export interface CampaignAttributionState {
  /** `true` until the SecureStore read resolves. Callers that can wait (a
   * confirm screen mounted well before the guest taps submit) should treat
   * `loading` as "not ready yet"; callers that cannot wait may just read
   * `attribution` — a `null` here is "no promo to attach", exactly like a
   * guest with no deep link at all, never a thrown error. */
  loading: boolean;
  /** The active campaign tag, or `null` when there is none or it expired
   * (`CAMPAIGN_ATTRIBUTION_TTL_MS`, 30 days). */
  attribution: CampaignAttribution | null;
}

/**
 * Reads the campaign tag `DetourLinkRouter` persisted when a deferred Detour
 * link resolved, if any and if it has not expired. One SecureStore read per
 * mount — cheap enough to call from any screen that needs to attach a promo
 * (today: the booking confirm step), without threading the value through
 * navigation params.
 */
export function useCampaignAttribution(): CampaignAttributionState {
  const [state, setState] = useState<CampaignAttributionState>({
    loading: true,
    attribution: null,
  });

  useEffect(() => {
    let cancelled = false;
    readCampaignAttribution().then((attribution) => {
      if (!cancelled) setState({ loading: false, attribution });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
