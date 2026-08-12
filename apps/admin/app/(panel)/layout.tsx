"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import { useMyRestaurants } from "@/lib/use-my-restaurants";
import { AppShell } from "@/components/AppShell";
import { isPlatformRoute } from "@/lib/nav";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import { LoadingState } from "@/components/StateViews";
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
 * share one cache entry and one request.
 */
export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, token, user, restaurant, selectRestaurant, clearRestaurant } = useAuth();
  const { data: myRestaurants } = useMyRestaurants();

  const isAdmin = user?.role === "admin";
  const platformScreen = isPlatformRoute(pathname);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  // Reconcile the venue stored in localStorage with what the backend says the
  // caller manages now: a staff member removed from a team would otherwise keep
  // a dead selection and get 403 on every screen. Also picks up a renamed venue.
  useEffect(() => {
    if (!restaurant || !myRestaurants) return;
    const match = myRestaurants.find((r) => r.id === restaurant.id);
    if (!match) {
      clearRestaurant();
      return;
    }
    if (match.name !== restaurant.name) {
      selectRestaurant({ id: match.id, name: match.name });
    }
  }, [restaurant, myRestaurants, selectRestaurant, clearRestaurant]);

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
