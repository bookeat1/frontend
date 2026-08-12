"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import { NAV } from "@/lib/nav";
import { t } from "@/lib/i18n";

import { PushToggle } from "./PushToggle";
import { RestaurantSwitcher } from "./RestaurantSwitcher";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  // Only a superadmin sees both levels; for venue staff there is nothing to
  // separate, so the headings stay off.
  const showGroupTitles = user?.role === "admin";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (top bar on narrow screens). */}
      <aside className="flex flex-col border-b border-hairline bg-surface md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        {/* The wordmark links to the dashboard (Сводка), like a site logo. */}
        <Link
          href="/"
          aria-label="На главную (Сводка)"
          className="flex items-center gap-sm px-lg py-lg transition-opacity hover:opacity-80"
        >
          <span className="inline-block h-6 w-6 rounded-md bg-brand" aria-hidden="true" />
          <span className="text-sm font-bold text-text">BookEat</span>
        </Link>

        <nav
          aria-label="Основная навигация"
          className="flex gap-md overflow-x-auto px-md pb-md md:flex-col md:gap-lg md:overflow-visible"
        >
          {NAV.filter((group) => !group.adminOnly || user?.role === "admin").map((group) => (
            <div key={group.title} className="flex shrink-0 flex-col gap-xs md:shrink">
              {/* The label is what separates the two levels. Venue staff see a
                  single group, so its heading would be noise — it is drawn only
                  when there is something to tell apart. */}
              {showGroupTitles ? (
                <span className="px-md pt-xs text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {group.title}
                </span>
              ) : null}

              <div className="flex gap-xs md:flex-col">
                {group.items.map((item) => {
                  // "/" is the dashboard, not a prefix of everything: without the
                  // exact check every screen would light up the first nav item.
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main column. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-md border-b border-hairline bg-surface px-lg py-md">
          <div className="min-w-0">
            <RestaurantSwitcher />
          </div>
          <div className="flex items-center gap-md">
            <PushToggle />
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
