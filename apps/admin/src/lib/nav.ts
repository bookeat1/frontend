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
      { href: "/cuisines", label: t.admin.nav.cuisines },
      { href: "/venue-features", label: t.admin.nav.venueFeatures },
      { href: "/cities", label: t.admin.nav.cities },
      { href: "/platform-guests", label: t.admin.nav.platformGuests },
      { href: "/gastroguide", label: t.admin.nav.gastroguide },
      // «Статьи» — отдельная сущность рядом с подборками гастрогида (решение
      // владельца 2026-08-28): та же таблица и те же ручки редактора, но
      // `kind: "article"`, свой раздел и НЕТ рубрик. Пункт отдельный, а не
      // фильтр внутри гастрогида: разные сущности — разные разделы, иначе
      // разделение существует только на бэкенде.
      { href: "/articles", label: t.admin.nav.articles },
      // Гастропрогулки — второй вид редакционного контента гастрогида (свои
      // ручки /admin/gastroguide/routes, свои остановки). Отдельный пункт, а
      // не кнопка внутри «Статей»: целый тип контента, спрятанный за кнопкой
      // на чужом экране, редактор не находит.
      { href: "/gastroguide/routes", label: t.admin.nav.gastroRoutes },
      // «Выбрали для вас» — ручной состав первого блока главной. Той же
      // природы, что и гастрогид с модерацией главной: это витрина ВСЕЙ
      // платформы, у неё нет заведения, и правит её только суперадмин.
      { href: "/home-picks", label: t.admin.nav.homePicks },
      // Контент, у которого нет заведения (backend PR #103). Живёт в
      // платформенной группе, а значит: видит его только суперадмин и работает
      // он без выбранного заведения — выбирать нечего.
      { href: "/platform-promos", label: t.admin.nav.platformPromos },
      { href: "/platform-events", label: t.admin.nav.platformEvents },
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

/**
 * Какой пункт меню подсвечен на `pathname` — ровно ОДИН, самый длинный
 * подходящий href.
 *
 * Просто «pathname начинается с href» здесь уже не годится: /gastroguide/routes
 * начинается и с «/gastroguide», и с «/gastroguide/routes», и оба пункта
 * загорались бы разом. Побеждает более длинный (то есть более точный) — это
 * тот же принцип, по которому маршрутизаторы выбирают самое конкретное
 * совпадение.
 *
 * «/» из префиксного сравнения исключён нарочно: это дашборд заведения, а не
 * префикс всего на свете, — иначе подсвечивался бы первый пункт всегда.
 */
export function activeNavHref(pathname: string): string | null {
  let best: string | null = null;
  for (const group of NAV) {
    for (const item of group.items) {
      const matches =
        item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (best === null || item.href.length > best.length)) best = item.href;
    }
  }
  return best;
}
