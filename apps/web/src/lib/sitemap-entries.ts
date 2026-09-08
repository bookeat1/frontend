import type { MetadataRoute } from "next";

import { absoluteUrl } from "@web/lib/site";

/**
 * Что из сайта показывать роботам. Чистые данные, без запросов: `app/sitemap.ts`
 * и `app/robots.ts` только подставляют сюда то, что достали из API.
 *
 * Источник списка — реальные каталоги в `apps/web/app/`. Появился новый
 * публичный экран — добавить сюда; иначе робот узнает о нём только по ссылкам.
 */

/** Публичные статические страницы. Порядок = порядок в sitemap. */
export const PUBLIC_STATIC_ROUTES: readonly string[] = [
  "/",
  "/venues",
  "/events",
  "/guide",
  "/articles",
  "/about",
  "/how-it-works",
  "/contacts",
  "/jobs",
  "/offer",
  "/privacy",
  "/cancellation",
  "/brand/ocean-basket",
];

/**
 * Закрыто от роботов. Не «секретно» — просто без ценности для поиска и с
 * личным состоянием: вход, профиль, конкретная бронь, форма бронирования
 * (она у каждого заведения одна и та же), а `/kit` — витрина компонентов
 * для дизайнеров, не страница для гостя.
 *
 * `*` в середине пути понимают Google и Яндекс; для остальных это просто
 * не сработавшее правило, а не ошибка.
 */
export const ROBOTS_DISALLOW: readonly string[] = [
  "/login",
  "/profile",
  "/bookings/",
  "/venues/*/book",
  "/kit",
];

export interface SitemapSources {
  /** Идентификаторы заведений (`/venues/:id`, `/venues/:id/menu`). */
  venueIds: readonly string[];
  /** Идентификаторы предстоящих событий (`/events/:id`). */
  eventIds: readonly string[];
  /** Слаги статей гастрогида (`/articles/:slug`). */
  articleSlugs: readonly string[];
}

export const EMPTY_SOURCES: SitemapSources = { venueIds: [], eventIds: [], articleSlugs: [] };

/** Google принимает до 50 000 адресов в одном файле; мы далеко от предела, но пусть это будет явно. */
export const SITEMAP_MAX_URLS = 50_000;

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Собирает записи sitemap из статических маршрутов и того, что вернул API.
 * `base` подставляется тестами; в приложении это `siteUrl`.
 *
 * Без `lastModified`: у заведений и событий нет надёжной даты изменения в
 * публичном контракте, а ставить «сейчас» на всё — учить роботов не верить
 * этому полю.
 */
export function buildSitemapEntries(
  sources: SitemapSources,
  base?: string,
): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of PUBLIC_STATIC_ROUTES) {
    entries.push({
      url: absoluteUrl(route, base),
      changeFrequency: route === "/" || route === "/venues" || route === "/events" ? "daily" : "weekly",
      priority: route === "/" ? 1 : route === "/venues" ? 0.9 : 0.6,
    });
  }

  for (const id of unique(sources.venueIds)) {
    const encoded = encodeURIComponent(id);
    entries.push({ url: absoluteUrl(`/venues/${encoded}`, base), changeFrequency: "weekly", priority: 0.8 });
    entries.push({ url: absoluteUrl(`/venues/${encoded}/menu`, base), changeFrequency: "weekly", priority: 0.5 });
  }

  for (const id of unique(sources.eventIds)) {
    entries.push({ url: absoluteUrl(`/events/${encodeURIComponent(id)}`, base), changeFrequency: "daily", priority: 0.7 });
  }

  for (const slug of unique(sources.articleSlugs)) {
    entries.push({ url: absoluteUrl(`/articles/${encodeURIComponent(slug)}`, base), changeFrequency: "monthly", priority: 0.6 });
  }

  return entries.slice(0, SITEMAP_MAX_URLS);
}
