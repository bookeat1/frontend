"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  PlatformBookings,
  PlatformOverview,
  PlatformPayments,
  PlatformPeriod,
  TopRestaurant,
} from "@bookeat/api/admin";

import { apiClient } from "./api";
import { useAuth } from "./auth-context";

/**
 * The four reads behind the platform dashboard.
 *
 * They are deliberately four queries rather than one: the backend serves them
 * as four endpoints with different periods and different costs, and a single
 * combined hook would make the whole screen fail when one of them does. Here a
 * broken payments query leaves the other three cards on the screen.
 *
 * Every key carries the user id for the same reason the venue list does: two
 * accounts sharing a browser must never see each other's numbers, not even for
 * the instant before a refetch lands.
 */

/** Platform is superadmin-only. Anything else must not even fire the request:
 * a venue manager would get a 403 that looks like a bug to them. */
function useIsPlatformAdmin(): boolean {
  const { user, token } = useAuth();
  return Boolean(token) && user?.role === "admin";
}

export function usePlatformOverview(): UseQueryResult<PlatformOverview> {
  const { user } = useAuth();
  const enabled = useIsPlatformAdmin();
  return useQuery({
    queryKey: ["platform-overview", user?.id ?? null],
    queryFn: () => apiClient.platformOverview(),
    enabled,
    staleTime: 60_000,
  });
}

export function usePlatformBookings(period: PlatformPeriod): UseQueryResult<PlatformBookings> {
  const { user } = useAuth();
  const enabled = useIsPlatformAdmin();
  return useQuery({
    queryKey: ["platform-bookings", user?.id ?? null, period.from ?? null, period.to ?? null],
    queryFn: () => apiClient.platformBookings(period),
    enabled,
    staleTime: 60_000,
  });
}

export function usePlatformPayments(period: PlatformPeriod): UseQueryResult<PlatformPayments> {
  const { user } = useAuth();
  const enabled = useIsPlatformAdmin();
  return useQuery({
    queryKey: ["platform-payments", user?.id ?? null, period.from ?? null, period.to ?? null],
    queryFn: () => apiClient.platformPayments(period),
    enabled,
    staleTime: 60_000,
  });
}

export function usePlatformTopRestaurants(
  period: PlatformPeriod,
  by: "bookings" | "gmv",
): UseQueryResult<TopRestaurant[]> {
  const { user } = useAuth();
  const enabled = useIsPlatformAdmin();
  return useQuery({
    queryKey: ["platform-top", user?.id ?? null, period.from ?? null, period.to ?? null, by],
    queryFn: () => apiClient.platformTopRestaurants(period, by, 10),
    enabled,
    staleTime: 60_000,
  });
}

export { useIsPlatformAdmin };
