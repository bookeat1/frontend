"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { PlatformPeriod, VenueDashboardSummary, VenueLoadSlot } from "@bookeat/api/admin";

import { apiClient } from "./api";
import { useAuth } from "./auth-context";

/**
 * The venue's own numbers. Two queries rather than one, for the same reason the
 * platform dashboard splits its four: a failing load chart should not blank the
 * counters above it.
 *
 * The key carries the restaurant id, so switching venues in the header shows
 * the new venue's numbers instead of the previous one's while it refetches.
 */

export function useVenueSummary(period: PlatformPeriod): UseQueryResult<VenueDashboardSummary> {
  const { token, restaurant } = useAuth();
  const id = restaurant?.id ?? null;
  return useQuery({
    queryKey: ["venue-summary", id, period.from ?? null, period.to ?? null],
    queryFn: () => apiClient.venueDashboardSummary(id as string, period),
    enabled: Boolean(token && id),
    staleTime: 60_000,
  });
}

export function useVenueLoad(period: PlatformPeriod): UseQueryResult<VenueLoadSlot[]> {
  const { token, restaurant } = useAuth();
  const id = restaurant?.id ?? null;
  return useQuery({
    queryKey: ["venue-load", id, period.from ?? null, period.to ?? null],
    queryFn: () => apiClient.venueDashboardLoad(id as string, period),
    enabled: Boolean(token && id),
    staleTime: 60_000,
  });
}
