"use client";

import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { roleLabel, useMyRestaurants } from "@/lib/use-my-restaurants";

/**
 * Venue indicator in the panel chrome. A manager of several venues switches
 * often, so switching is one click here rather than a trip back through the
 * post-login picker. With a single venue there is nothing to switch to, so the
 * name renders as plain text and no dead control is offered.
 *
 * Reuses the my-restaurants cache entry, so opening it costs no request.
 */
export function RestaurantSwitcher() {
  const { restaurant, selectRestaurant } = useAuth();
  const query = useMyRestaurants();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const list = query.data ?? [];
  const switchable = list.length > 1;

  if (!switchable) {
    return (
      <p className="truncate text-sm font-semibold text-text" title={restaurant?.name}>
        {restaurant?.name}
      </p>
    );
  }

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
            {restaurant?.name}
          </span>
          <span className="block text-[12px] text-text-muted">{t.admin.restaurant.switch}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-[10px] text-text-muted">
          ▼
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t.admin.restaurant.current}
          className="absolute left-0 top-full z-20 mt-xs max-h-[60vh] w-[min(320px,calc(100vw-2rem))] overflow-y-auto rounded-card border border-hairline bg-surface p-xs shadow-lg"
        >
          {list.map((r) => {
            const active = r.id === restaurant?.id;
            return (
              <li key={r.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    selectRestaurant({ id: r.id, name: r.name });
                  }}
                  className={`flex min-h-[44px] w-full items-center justify-between gap-sm rounded-card px-md py-sm text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    active ? "bg-chip font-semibold text-text" : "text-text hover:bg-chip"
                  }`}
                >
                  <span className="min-w-0 break-words">{r.name}</span>
                  <span className="shrink-0 rounded-pill bg-chip-active px-sm py-xxs text-[11px] text-white">
                    {roleLabel(r.role)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
