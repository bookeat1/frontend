"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { roleLabel, useMyRestaurants } from "@/lib/use-my-restaurants";
import { filterVenues } from "@/lib/venue-picking";
import { ErrorState, LoadingState } from "./StateViews";
import { Button } from "./ui/Button";

/**
 * Post-login venue selection, driven entirely by GET /admin/my-restaurants —
 * no restaurant UUID is ever typed or hardcoded:
 *  - exactly one venue -> auto-selected, the picker never appears;
 *  - several           -> a keyboard-reachable list of buttons, with a search
 *                         box once the list is long enough to scroll (a
 *                         superadmin is staff at every venue on the platform);
 *  - none              -> an honest "you are not staff anywhere yet" screen;
 *  - request failed    -> an error screen with a retry.
 */
export function RestaurantPicker({ title, subtitle }: { title?: string; subtitle?: string } = {}) {
  const { user, logout, selectRestaurant } = useAuth();
  const query = useMyRestaurants();
  const list = query.data;
  const [search, setSearch] = useState("");
  // Below this the list fits on screen and a search box is one more control to
  // read past; above it, scrolling is the only way to find anything.
  const SEARCHABLE_FROM = 8;
  const shown = useMemo(() => filterVenues(list ?? [], search), [list, search]);

  // Auto-select when the caller manages exactly one venue: a dialog with a
  // single option is a click that teaches nothing.
  useEffect(() => {
    if (list && list.length === 1) {
      selectRestaurant({ id: list[0].id, name: list[0].name });
    }
  }, [list, selectRestaurant]);

  if (query.isPending) {
    return (
      <Screen>
        <LoadingState title={t.admin.restaurant.loadingList} />
      </Screen>
    );
  }

  if (query.isError || !list) {
    return (
      <Screen>
        <Card>
          <ErrorState
            message={t.admin.restaurant.errorTitle}
            onRetry={() => void query.refetch()}
          />
          <Footer email={user?.email ?? user?.full_name} onLogout={() => void logout()} />
        </Card>
      </Screen>
    );
  }

  // No memberships: say so plainly and tell them what unblocks it. Retry stays
  // available — the owner may be adding them to the team right now.
  if (list.length === 0) {
    return (
      <Screen>
        <Card>
          <h1 className="text-xl font-bold text-text">{t.admin.restaurant.emptyTitle}</h1>
          <p className="mt-sm text-sm text-text-muted">{t.admin.restaurant.emptySubtitle}</p>
          <Button
            variant="secondary"
            className="mt-xl w-full"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t.admin.common.retry}
          </Button>
          <Footer email={user?.email ?? user?.full_name} onLogout={() => void logout()} />
        </Card>
      </Screen>
    );
  }

  // A single venue is being auto-selected by the effect above; hold a spinner
  // for that one frame rather than flashing a one-item list.
  if (list.length === 1) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-bold text-text">{title ?? t.admin.restaurant.pickTitle}</h1>
        <p className="mt-sm text-sm text-text-muted">{subtitle ?? t.admin.restaurant.pickSubtitle}</p>

        {list.length >= SEARCHABLE_FROM ? (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.restaurant.searchPlaceholder}
            aria-label={t.admin.restaurant.searchPlaceholder}
            className="mt-lg w-full rounded-card bg-chip px-lg py-md text-sm text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        ) : null}

        {shown.length === 0 ? (
          <p className="mt-xl text-center text-sm text-text-muted">
            {t.admin.restaurant.searchEmpty}
          </p>
        ) : null}

        <ul className="mt-lg flex max-h-[52vh] flex-col gap-sm overflow-y-auto">
          {shown.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => selectRestaurant({ id: r.id, name: r.name })}
                className="flex min-h-[56px] w-full items-center justify-between gap-md rounded-card border border-hairline bg-white px-lg py-md text-left transition-colors hover:border-brand focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {/* min-w-0 + break-words: long Russian venue names must wrap, not
                    push the role chip off the card. */}
                <span className="min-w-0 break-words text-sm font-medium text-text">{r.name}</span>
                <span className="shrink-0 rounded-pill bg-chip px-sm py-xxs text-[11px] text-text-muted">
                  {roleLabel(r.role)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <Footer email={user?.email ?? user?.full_name} onLogout={() => void logout()} />
      </Card>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-lg bg-screen px-lg py-huge">
      {children}
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[460px] rounded-card bg-surface p-huge shadow-sm">{children}</div>
  );
}

function Footer({ email, onLogout }: { email?: string | null; onLogout: () => void }) {
  return (
    <div className="mt-lg flex items-center justify-between gap-md text-sm text-text-muted">
      <span className="min-w-0 truncate">{email}</span>
      <button
        type="button"
        onClick={onLogout}
        className="shrink-0 text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {t.admin.common.logout}
      </button>
    </div>
  );
}
