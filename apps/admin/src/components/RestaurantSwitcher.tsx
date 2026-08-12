"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MyRestaurant } from "@bookeat/api/admin";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { roleLabel, useMyRestaurants } from "@/lib/use-my-restaurants";
import { browserStorage } from "@/lib/token-store";
import { filterVenues, readRecentVenueIds, recentVenues } from "@/lib/venue-picking";

/**
 * Venue indicator in the panel chrome, and the ONLY way to change which venue
 * the panel is looking at. A manager of several venues switches often, so
 * switching is one click here rather than a trip back through the post-login
 * picker. With a single venue there is nothing to switch to, so the name
 * renders as plain text and no dead control is offered.
 *
 * For a superadmin the list is every venue on the platform, so the popover is
 * a search box first: recently used venues on top (they are what a person
 * comes back to), the full filtered list under them, and a link into the
 * «Заведения» catalog for anything else.
 *
 * Reuses the my-restaurants cache entry, so opening it costs no request.
 */
export function RestaurantSwitcher() {
  const { restaurant, selectRestaurant, user } = useAuth();
  const query = useMyRestaurants();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click and on Escape — a popover that only closes by
  // re-clicking the trigger feels stuck.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Opening puts the caret in the search box: with a hundred venues, typing is
  // the fast path and reaching for the mouse to click the field is not.
  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setSearch("");
  }, [open]);

  const list = useMemo(() => query.data ?? [], [query.data]);
  const isAdmin = user?.role === "admin";
  const switchable = list.length > 1;

  const recent = useMemo(
    () => (search ? [] : recentVenues(list, readRecentVenueIds(browserStorage()), restaurant?.id ?? null)),
    // `open` is a dependency on purpose: the history is re-read every time the
    // popover opens, so a switch made in another tab is reflected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, restaurant?.id, search, open],
  );
  const matches = useMemo(() => filterVenues(list, search), [list, search]);

  if (!switchable) {
    return (
      <p className="truncate text-sm font-semibold text-text" title={restaurant?.name}>
        {restaurant?.name}
      </p>
    );
  }

  const choose = (r: MyRestaurant) => {
    setOpen(false);
    selectRestaurant({ id: r.id, name: r.name });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.admin.restaurant.switchAria}
        className="flex min-h-[44px] max-w-[240px] items-center gap-xs rounded-card px-xs text-left hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-text">
            {/* A superadmin can be in the panel with no venue chosen at all —
                the platform screens do not need one. Say so instead of drawing
                an empty line. */}
            {restaurant?.name ?? t.admin.restaurant.none}
          </span>
          <span className="block text-[12px] text-text-muted">{t.admin.restaurant.switch}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-[10px] text-text-muted">
          ▼
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-xs flex max-h-[70vh] w-[min(360px,calc(100vw-2rem))] flex-col rounded-card border border-hairline bg-surface shadow-lg">
          <div className="border-b border-hairline p-xs">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.admin.restaurant.searchPlaceholder}
              aria-label={t.admin.restaurant.searchPlaceholder}
              className="w-full rounded-card bg-chip px-md py-sm text-sm text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-xs">
            {recent.length > 0 ? (
              <>
                <Section title={t.admin.restaurant.recent} />
                <ul role="listbox" aria-label={t.admin.restaurant.recent}>
                  {recent.map((r) => (
                    <VenueRow key={`recent-${r.id}`} venue={r} active={false} onPick={choose} />
                  ))}
                </ul>
                <Section title={t.admin.restaurant.all} />
              </>
            ) : null}

            {matches.length === 0 ? (
              <p className="px-md py-lg text-center text-sm text-text-muted">
                {t.admin.restaurant.searchEmpty}
              </p>
            ) : (
              <ul role="listbox" aria-label={t.admin.restaurant.current}>
                {matches.map((r) => (
                  <VenueRow
                    key={r.id}
                    venue={r}
                    active={r.id === restaurant?.id}
                    onPick={choose}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* The catalog is where a superadmin edits venues; the switcher only
              changes which one the panel is looking at. Linking them here is
              what keeps «Заведения» out of the venue-level menu. */}
          {isAdmin ? (
            <Link
              href="/venues"
              onClick={() => setOpen(false)}
              className="border-t border-hairline px-md py-sm text-sm font-medium text-brand hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {t.admin.restaurant.allVenues}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <p className="px-md pb-xxs pt-sm text-[11px] font-semibold uppercase tracking-wide text-text-muted">
      {title}
    </p>
  );
}

function VenueRow({
  venue,
  active,
  onPick,
}: {
  venue: MyRestaurant;
  active: boolean;
  onPick: (venue: MyRestaurant) => void;
}) {
  return (
    <li role="option" aria-selected={active}>
      <button
        type="button"
        onClick={() => onPick(venue)}
        className={`flex min-h-[44px] w-full items-center justify-between gap-sm rounded-card px-md py-sm text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          active ? "bg-chip font-semibold text-text" : "text-text hover:bg-chip"
        }`}
      >
        <span className="min-w-0 break-words">{venue.name}</span>
        <span className="shrink-0 rounded-pill bg-chip-active px-sm py-xxs text-[11px] text-white">
          {roleLabel(venue.role)}
        </span>
      </button>
    </li>
  );
}
