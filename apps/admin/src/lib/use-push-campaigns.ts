"use client";

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  pushCampaignsPollIntervalMs,
  type ListPushCampaignsParams,
  type PushCampaignSummary,
} from "@bookeat/api/admin";

import { apiClient } from "./api";

export interface PushCampaignsListClient {
  listPushCampaigns(params: ListPushCampaignsParams): Promise<PushCampaignSummary[]>;
}

function pushCampaignsQueryKey(params: ListPushCampaignsParams): readonly unknown[] {
  return "restaurantId" in params
    ? (["push-campaigns", params.kind, params.restaurantId] as const)
    : (["push-campaigns", params.kind, "platform"] as const);
}

/**
 * The one `listPushCampaigns` call a screen makes (spec §4 criterion 26:
 * "одна выборка на экран, маппинг по subject_id" — the same shape as the
 * existing `listVenueFeed` + `feedByItemId` pair in `EventsView`/`PromosView`).
 *
 * Polls every 5s while any campaign in the result is `queued`/`sending`, stops
 * once none are (criterion 29) — the decision itself lives in
 * `pushCampaignsPollIntervalMs` so it is unit-testable without React.
 */
export function usePushCampaigns(
  params: ListPushCampaignsParams,
  client: PushCampaignsListClient = apiClient,
): {
  query: UseQueryResult<PushCampaignSummary[]>;
  bySubjectId: Map<string, PushCampaignSummary>;
} {
  const query = useQuery({
    queryKey: pushCampaignsQueryKey(params),
    queryFn: () => client.listPushCampaigns(params),
    refetchInterval: (q) => pushCampaignsPollIntervalMs(q.state.data),
  });

  const bySubjectId = useMemo(() => {
    const map = new Map<string, PushCampaignSummary>();
    for (const campaign of query.data ?? []) map.set(campaign.subject_id, campaign);
    return map;
  }, [query.data]);

  return { query, bySubjectId };
}
