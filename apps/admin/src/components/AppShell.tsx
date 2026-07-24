"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

interface NavItem {
  href: string;
  label: string;
  /** Deferred screens are shown but disabled (backend not ready). */
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: "/bookings", label: t.admin.nav.bookings },
  { href: "/menu", label: t.admin.nav.menu },
  { href: "/schedule", label: t.admin.nav.schedule, soon: true },
  { href: "/events", label: t.admin.nav.events, soon: true },
  { href: "/guests", label: t.admin.nav.guests, soon: true },
  { href: "/settings", label: t.admin.nav.settings, soon: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, restaurant, logout, clearRestaurant } = useAuth();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (top bar on narrow screens). */}
      <aside className="flex flex-col border-b border-hairline bg-surface md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-sm px-lg py-lg">
          <span className="inline-block h-6 w-6 rounded-md bg-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-text">BookEat</span>
        </div>

        <nav aria-label="Основная навигация" className="flex gap-xs overflow-x-auto px-md pb-md md:flex-col md:overflow-visible">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            if (item.soon) {
              return (
                <span
                  key={item.href}
                  aria-disabled="true"
                  className="flex shrink-0 items-center justify-between gap-sm rounded-card px-md py-sm text-sm text-text-muted opacity-60 md:shrink"
                >
                  {item.label}
                  <span className="rounded-pill bg-chip px-sm py-xxs text-[10px] uppercase tracking-wide">
                    {t.admin.nav.soon}
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-card px-md py-sm text-sm font-medium transition-colors md:shrink ${
                  active ? "bg-chip-active text-white" : "text-text hover:bg-chip"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main column. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-md border-b border-hairline bg-surface px-lg py-md">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{restaurant?.name}</p>
            <button
              type="button"
              onClick={clearRestaurant}
              className="text-[12px] text-text-muted hover:text-brand hover:underline"
            >
              {t.admin.restaurant.switch}
            </button>
          </div>
          <div className="flex items-center gap-md">
            <span className="hidden max-w-[180px] truncate text-sm text-text-muted sm:inline">
              {user?.email ?? user?.full_name}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-pill px-md py-xs text-sm font-medium text-brand hover:bg-chip"
            >
              {t.admin.common.logout}
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-screen p-lg">{children}</main>
      </div>
    </div>
  );
}
