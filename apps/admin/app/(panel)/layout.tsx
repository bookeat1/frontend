"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import { useMyRestaurants } from "@/lib/use-my-restaurants";
import { AppShell } from "@/components/AppShell";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import { LoadingState } from "@/components/StateViews";

/** Auth guard for every panel screen: unauthenticated -> /login;
 * authenticated but no venue chosen -> the venue picker. Also owns the
 * my-restaurants query so the picker and the header switcher share one cache
 * entry and one request. */
export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { hydrated, token, restaurant, selectRestaurant, clearRestaurant } = useAuth();
  const { data: myRestaurants } = useMyRestaurants();

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

  if (!hydrated || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-screen p-lg">
        <LoadingState />
      </main>
    );
  }

  if (!restaurant) return <RestaurantPicker />;

  return <AppShell>{children}</AppShell>;
}
