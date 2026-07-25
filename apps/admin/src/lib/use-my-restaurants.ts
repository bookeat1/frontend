"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { MyRestaurant } from "@bookeat/api/admin";

import { apiClient } from "./api";
import { useAuth } from "./auth-context";
import { t } from "./i18n";

/**
 * GET /admin/my-restaurants — the venues the signed-in staff member manages.
 * Shared by the post-login picker and the header switcher so both read one
 * cache entry (switching venues never refetches the list).
 *
 * The key carries the user id: two staff members using the same browser must
 * never see each other's venues, even for the instant before a refetch lands.
 */
export function useMyRestaurants(): UseQueryResult<MyRestaurant[]> {
  const { user, token } = useAuth();
  return useQuery({
    queryKey: ["my-restaurants", user?.id ?? null],
    queryFn: () => apiClient.listMyRestaurants(),
    enabled: Boolean(token),
    // The staff-to-venue mapping changes rarely; don't re-hit it on every mount.
    staleTime: 5 * 60_000,
  });
}

/** Russian label for a role returned by my-restaurants. Unknown roles (the
 * backend may add more) fall through to the raw value rather than blank. */
export function roleLabel(role: MyRestaurant["role"]): string {
  switch (role) {
    case "owner":
      return t.admin.restaurant.roleOwner;
    case "manager":
      return t.admin.restaurant.roleManager;
    case "hostess":
      return t.admin.restaurant.roleHostess;
    case "admin":
      return t.admin.restaurant.roleAdmin;
    default:
      return role;
  }
}
