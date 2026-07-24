"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import { LoadingState } from "@/components/StateViews";

/** Auth guard for every panel screen: unauthenticated -> /login;
 * authenticated but no restaurant chosen -> the restaurant gate. */
export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { hydrated, token, restaurant } = useAuth();

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

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
