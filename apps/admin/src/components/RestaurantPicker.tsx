"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MyRestaurant } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { RestaurantGate } from "./RestaurantGate";
import { ErrorState, LoadingState } from "./StateViews";

/**
 * Post-login restaurant selection. Calls GET /admin/my-restaurants and shows a
 * picker instead of asking staff to type a UUID:
 *  - exactly one restaurant  -> auto-select and go straight to the panel;
 *  - several                 -> a keyboard-reachable list of buttons;
 *  - none (or "enter manually") -> fall back to the manual-id RestaurantGate.
 */
export function RestaurantPicker() {
  const { user, logout, selectRestaurant } = useAuth();
  const [manual, setManual] = useState(false);

  const query = useQuery({
    queryKey: ["my-restaurants"],
    queryFn: () => apiClient.listMyRestaurants(),
  });

  const list = query.data;

  // Auto-select when the caller manages exactly one restaurant.
  useEffect(() => {
    if (list && list.length === 1) {
      selectRestaurant({ id: list[0].id, name: list[0].name });
    }
  }, [list, selectRestaurant]);

  if (manual) return <RestaurantGate />;

  if (query.isPending) {
    return (
      <Screen>
        <LoadingState title={t.admin.restaurant.loadingList} />
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen>
        <ErrorState onRetry={() => void query.refetch()} />
        <Footer email={user?.email ?? user?.full_name} onLogout={() => void logout()} />
      </Screen>
    );
  }

  // Empty list -> offer the manual gate straight away.
  if (!list || list.length === 0) {
    return (
      <Screen>
        <div className="w-full max-w-[460px] rounded-card bg-surface p-huge text-center shadow-sm">
          <h1 className="text-xl font-bold text-text">{t.admin.restaurant.emptyTitle}</h1>
          <p className="mt-sm text-sm text-text-muted">{t.admin.restaurant.emptySubtitle}</p>
          <button
            type="button"
            onClick={() => setManual(true)}
            className="mt-xl min-h-[44px] w-full rounded-pill bg-brand px-lg text-sm font-medium text-white hover:opacity-90"
          >
            {t.admin.restaurant.manualEntry}
          </button>
          <Footer email={user?.email ?? user?.full_name} onLogout={() => void logout()} />
        </div>
      </Screen>
    );
  }

  // A single restaurant is being auto-selected; show a spinner during the flip.
  if (list.length === 1) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="w-full max-w-[460px] rounded-card bg-surface p-huge shadow-sm">
        <h1 className="text-xl font-bold text-text">{t.admin.restaurant.pickTitle}</h1>
        <p className="mt-sm text-sm text-text-muted">{t.admin.restaurant.pickSubtitle}</p>

        <ul className="mt-xl flex flex-col gap-sm">
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => selectRestaurant({ id: r.id, name: r.name })}
                className="flex min-h-[56px] w-full items-center justify-between gap-md rounded-card border border-hairline bg-white px-lg py-md text-left transition-colors hover:border-brand"
              >
                <span className="min-w-0 break-words text-sm font-medium text-text">{r.name}</span>
                <span className="shrink-0 rounded-pill bg-chip px-sm py-xxs text-[11px] text-text-muted">
                  {roleLabel(r.role)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setManual(true)}
          className="mt-lg text-sm text-brand hover:underline"
        >
          {t.admin.restaurant.manualEntry}
        </button>

        <Footer email={user?.email ?? user?.full_name} onLogout={() => void logout()} />
      </div>
    </Screen>
  );
}

function roleLabel(role: MyRestaurant["role"]): string {
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

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-lg bg-screen px-lg">
      {children}
    </main>
  );
}

function Footer({ email, onLogout }: { email?: string | null; onLogout: () => void }) {
  return (
    <div className="mt-lg flex items-center justify-between text-sm text-text-muted">
      <span className="truncate">{email}</span>
      <button type="button" onClick={onLogout} className="text-brand hover:underline">
        {t.admin.common.logout}
      </button>
    </div>
  );
}
