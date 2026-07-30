"use client";

import { useAuth } from "@/lib/auth-context";
import { VenueDashboard } from "./VenueDashboard";
import { VenueTodayBoard } from "./VenueTodayBoard";

/**
 * The panel's landing page: the operational block on top, the period numbers
 * underneath.
 *
 * The two are independent queries on purpose — an unavailable summary must not
 * take the unanswered requests down with it, and vice versa.
 */
export function PanelHome() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant?.id ?? null;

  return (
    <div className="flex flex-col">
      {restaurantId ? (
        <div className="p-6 pb-0">
          <VenueTodayBoard restaurantId={restaurantId} />
        </div>
      ) : null}
      <VenueDashboard />
    </div>
  );
}
