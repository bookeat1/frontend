import { t } from "./i18n";

/**
 * The panel's navigation, as data.
 *
 * It lives here rather than inside AppShell because two different places have
 * to agree about it: the menu that draws the links, and the panel guard that
 * decides whether a screen can be opened with NO venue chosen. When that list
 * was a second copy next to the guard, the two drifted.
 */

export interface NavItem {
  href: string;
  label: string;
  /** Deferred screens are shown but disabled (backend not ready). */
  soon?: boolean;
}

export interface NavGroup {
  /** Shown above the group. The two groups answer two different questions —
   * «что происходит в ЭТОМ заведении» and «что происходит на всей платформе» —
   * and until they were labelled, «Заведения» in the list read as a second copy
   * of the venue switcher in the header. */
  title: string;
  /** Platform-wide screens: hidden from venue staff, who would only get a 403
   * behind them. The backend gates them regardless — this is about not showing
   * a door that is not theirs. */
  adminOnly?: boolean;
  /** Screens that work without a chosen venue. The platform group does; the
   * venue group cannot, by definition. */
  worksWithoutVenue?: boolean;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: t.admin.nav.groupVenue,
    items: [
      { href: "/", label: t.admin.nav.summary },
      { href: "/bookings", label: t.admin.nav.bookings },
      { href: "/menu", label: t.admin.nav.menu },
      { href: "/schedule", label: t.admin.nav.schedule },
      { href: "/events", label: t.admin.nav.events },
      { href: "/promos", label: t.admin.nav.promos },
      { href: "/stories", label: t.admin.nav.stories },
      { href: "/guests", label: t.admin.nav.guests },
      { href: "/settings", label: t.admin.nav.settings },
    ],
  },
  {
    title: t.admin.nav.groupPlatform,
    adminOnly: true,
    worksWithoutVenue: true,
    items: [
      { href: "/platform", label: t.admin.nav.platform },
      { href: "/venues", label: t.admin.nav.venues },
      { href: "/platform-guests", label: t.admin.nav.platformGuests },
      { href: "/gastroguide", label: t.admin.nav.gastroguide },
      { href: "/feed-moderation", label: t.admin.nav.feedModeration },
    ],
  },
];

/** The routes that need no venue — the platform group, read off NAV itself. */
export const PLATFORM_ROUTES: string[] = NAV.filter((g) => g.worksWithoutVenue).flatMap((g) =>
  g.items.map((i) => i.href),
);

/**
 * Whether `pathname` is one of those routes — exactly, or a screen under it
 * (`/venues/123`). "/" is deliberately NOT a platform route: it is the venue
 * dashboard, and matching it by prefix would make every screen platform-level.
 */
export function isPlatformRoute(pathname: string): boolean {
  return PLATFORM_ROUTES.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}
