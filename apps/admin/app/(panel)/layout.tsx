"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import { useMyRestaurants } from "@/lib/use-my-restaurants";
import { AppShell } from "@/components/AppShell";
import { isPlatformRoute } from "@/lib/nav";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { isVenueScopedKey, isVenueUnavailableError, venueAccess } from "@/lib/venue-access";
import { t } from "@/lib/i18n";

/**
 * Auth guard for every panel screen, and the answer to "where do I land after
 * signing in".
 *
 * The landing depends on WHO signed in, because the two roles do different
 * jobs. Venue staff work inside one venue, so they land in it — and when they
 * manage exactly one, they never see a picker at all. A superadmin is staff at
 * EVERY venue on the platform: asking them to pick one out of a hundred before
 * showing anything is asking a question they usually do not have an answer to,
 * so they land on the platform screens, which need no venue at all. They still
 * get the picker the moment they open a venue-level screen — that screen is
 * about one venue by definition.
 *
 * Also owns the my-restaurants query so the picker and the header switcher
 * share one cache entry and one request — and it is the ONE place where the
 * remembered venue is checked against that list. Venue screens do not mount
 * until the check passes, so a venue id left over from another server (or from
 * a team someone was removed from) can no longer be sent to the API by a dozen
 * screens at once.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { hydrated, token, user, restaurant, selectRestaurant, clearRestaurant } = useAuth();
  const myRestaurants = useMyRestaurants();

  const isAdmin = user?.role === "admin";
  const platformScreen = isPlatformRoute(pathname);
  const access = venueAccess(restaurant?.id, myRestaurants.data);
  /** Name of the venue we just dropped, so the picker can say WHY it is
   * asking. Cleared as soon as a venue is chosen again. */
  const [droppedVenue, setDroppedVenue] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  // Reconcile the venue stored in localStorage with what the backend says the
  // caller manages now: a venue that does not exist in THIS environment, or a
  // staff member removed from a team, would otherwise keep a dead selection and
  // 404 on every screen. Also picks up a renamed venue.
  useEffect(() => {
    if (!restaurant || !myRestaurants.data) return;
    const match = myRestaurants.data.find((r) => r.id === restaurant.id);
    if (!match) {
      setDroppedVenue(restaurant.name);
      clearRestaurant();
      return;
    }
    if (match.name !== restaurant.name) {
      selectRestaurant({ id: match.id, name: match.name });
    }
  }, [restaurant, myRestaurants.data, selectRestaurant, clearRestaurant]);

  useEffect(() => {
    if (restaurant) setDroppedVenue(null);
  }, [restaurant]);

  // A venue can also disappear DURING a shift, and then the cached
  // my-restaurants list still vouches for it. Any venue-scoped query failing
  // with 404/403 re-checks the list once, and the reconcile above does the
  // rest — one mechanism instead of a per-screen guess about what the error
  // meant.
  const recheckedFor = useRef<string | null>(null);
  useEffect(() => {
    const venueId = restaurant?.id;
    if (!venueId) return;
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (!isVenueScopedKey(event.query.queryKey, venueId)) return;
      if (!isVenueUnavailableError(event.action.error)) return;
      if (recheckedFor.current === venueId) return; // once per venue, never a loop
      recheckedFor.current = venueId;
      void queryClient.invalidateQueries({ queryKey: ["my-restaurants"] });
    });
  }, [queryClient, restaurant?.id]);

  // A superadmin arriving at the venue dashboard with no venue chosen is a
  // superadmin who just signed in. Send them to the platform screens rather
  // than to a hundred-row picker. Anywhere else they navigated on purpose, so
  // the redirect stays off.
  useEffect(() => {
    if (!hydrated || !token) return;
    if (isAdmin && !restaurant && pathname === "/") router.replace("/platform");
  }, [hydrated, token, isAdmin, restaurant, pathname, router]);

  if (!hydrated || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-screen p-lg">
        <LoadingState />
      </main>
    );
  }

  // Venue chosen but not yet confirmed. Platform screens read no venue, so they
  // are let through; a venue screen waits, because mounting it means firing its
  // requests with an id that may belong to another environment.
  if (restaurant && access !== "granted" && !platformScreen) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-screen p-lg">
        {access === "checking" && myRestaurants.isError ? (
          // The list itself failed: this one really is "try again".
          <ErrorState
            message={t.admin.restaurant.verifyErrorDescription}
            onRetry={() => void myRestaurants.refetch()}
          />
        ) : (
          // "checking" — waiting for the list; "revoked" — the effect above is
          // clearing the selection this very render, so hold a spinner rather
          // than flash the venue's screens.
          <LoadingState title={t.admin.restaurant.checkingVenue} />
        )}
      </main>
    );
  }

  if (!restaurant) {
    // Platform screens do not read a venue, so a superadmin sees the panel with
    // the venue slot simply empty.
    if (isAdmin && platformScreen) return <AppShell>{children}</AppShell>;
    // The redirect above is in flight; a picker flashed here would be a
    // question that answers itself a frame later.
    if (isAdmin && pathname === "/") {
      return (
        <main className="flex min-h-screen items-center justify-center bg-screen p-lg">
          <LoadingState />
        </main>
      );
    }
    // A venue we just dropped is a question with a reason: say the reason, and
    // ask it as a choice — not as an error with a pointless retry.
    if (droppedVenue !== null) {
      return (
        <RestaurantPicker
          title={t.admin.restaurant.unavailableTitle}
          subtitle={
            droppedVenue
              ? t.admin.restaurant.unavailableSubtitle(droppedVenue)
              : t.admin.restaurant.unavailableSubtitleNoName
          }
        />
      );
    }
    // Venue-level screen without a venue: ask, and say why it is being asked.
    if (isAdmin) {
      return (
        <RestaurantPicker
          title={t.admin.restaurant.neededTitle}
          subtitle={t.admin.restaurant.neededSubtitle}
        />
      );
    }
    return <RestaurantPicker />;
  }

  return <AppShell>{children}</AppShell>;
}
