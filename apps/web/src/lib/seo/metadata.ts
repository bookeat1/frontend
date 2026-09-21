import type { Metadata } from "next";
import type { PlatformPage, PlatformPageSlug, Restaurant, SearchResult } from "@bookeat/api/client";

import { t } from "@web/lib/i18n";
import { priceLabel } from "@web/lib/format";
import { todaySchedule } from "@web/lib/schedule";
import { absoluteUrl } from "@web/lib/site";

/**
 * Сборщики `<title>` / `<meta name="description">` / canonical / OG (SEO T3,
 * `web-ai-search-visibility-20260918.md`, §5.2, критерии B13-B18). Чистые
 * функции — принимают уже загруженные данные экрана, без сети.
 *
 * Серверный HTML сегодня только русский (§6 «Принятые допущения» спеки),
 * поэтому тексты идут через `t = getDictionary("ru")` из `lib/i18n.ts`, а не
 * через `useT()` — этот модуль зовётся из серверных `generateMetadata`, где
 * контекста локали нет и не будет.
 */

/** Обрезка по границе слова, а не байта — «…Grill» посреди слова хуже, чем
 * укороченное предложение. */
function truncateAtWord(text: string, maxLength: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/** `canonical(path)` — обёртка над `absoluteUrl`, единая точка для всех
 * `generateMetadata`: канонический адрес никогда не несёт query (B-18). */
export function canonical(path: string): string {
  return absoluteUrl(path);
}

const OG_LOCALE = "ru_RU";
const DEFAULT_OG_IMAGE = absoluteUrl("/brand/hero.webp");

interface BuildOgOptions {
  path: string;
  title: string;
  description: string;
  image?: string;
}

/** OG/Twitter — общая форма для всех публичных страниц (критерий B-16). */
function openGraph(options: BuildOgOptions): Metadata {
  const url = canonical(options.path);
  const image = options.image ?? DEFAULT_OG_IMAGE;
  return {
    title: options.title,
    description: options.description,
    alternates: { canonical: url },
    openGraph: {
      title: options.title,
      description: options.description,
      url,
      type: "website",
      locale: OG_LOCALE,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: [image],
    },
  };
}

/**
 * `/venues/[id]` — название обрезается ПОД суффикс, а не наоборот (B-14: «по
 * названию, а не по городу»): «Ресторан с очень длинным названием, Алматы:
 * забронировать столик» короче 70 символов должен остаться целиком, а не
 * потерять город.
 */
export function venueMetadata(venue: Restaurant): Metadata {
  const suffix = t.web.seo.venueTitleSuffix(venue.city);
  const maxNameLength = Math.max(70 - suffix.length, 10);
  const name = venue.name.length > maxNameLength ? truncateAtWord(venue.name, maxNameLength) : venue.name;
  const title = `${name}${suffix}`;

  const cuisines = venue.cuisines.map((c) => c.name).filter(Boolean).join(", ");
  const price = priceLabel(venue.priceLevel, venue.priceRange, t);
  const today = todaySchedule(venue.schedule);
  const hours =
    today?.isOpen && today.opensAt && today.closesAt
      ? t.web.seo.hoursToday(today.opensAt, today.closesAt)
      : venue.openingHoursText || undefined;

  const factSentence = [cuisines, price].filter(Boolean).join(", ");
  const description = truncateAtWord(
    [
      `${venue.name}: ${factSentence}.`,
      `${venue.address}, ${venue.city}.`,
      hours,
      t.web.seo.venueBookingCta,
    ]
      .filter(Boolean)
      .join(" "),
    160,
  );

  return openGraph({
    path: `/venues/${venue.id}`,
    title,
    description,
    image: venue.coverPhoto?.uri,
  });
}

/** `/venues` — листинг без фильтров (первая страница, как её видит робот). */
export function catalogMetadata(result: SearchResult | null): Metadata {
  const count = result?.total ?? result?.items.length ?? 0;
  const topCuisines = Array.from(
    new Set((result?.items ?? []).flatMap((venue) => venue.cuisines.map((c) => c.name))),
  )
    .slice(0, 5)
    .join(", ");
  const description = truncateAtWord(
    count > 0
      ? t.web.seo.catalogDescription(count, topCuisines)
      : t.web.footer.tagline,
    160,
  );
  return openGraph({ path: "/venues", title: t.web.seo.catalogTitle, description });
}

/** `/` — главная. */
export function homeMetadata(result: SearchResult | null, city: string): Metadata {
  const count = result?.total ?? result?.items.length ?? 0;
  const description = truncateAtWord(
    count > 0 ? t.web.seo.homeDescription(count, city) : t.web.footer.tagline,
    160,
  );
  return openGraph({ path: "/", title: t.web.seo.homeTitle, description });
}

/** Семь редактируемых текстовых страниц (`/about`, `/how-it-works`, …). */
export function pageMetadata(slug: PlatformPageSlug, page: PlatformPage | null): Metadata {
  const title = page?.title ?? t.web.pages.tabTitle[slug];
  const description = page?.body
    ? truncateAtWord(page.body.replace(/[#*`>_-]/g, " "), 160)
    : t.web.footer.tagline;
  return openGraph({ path: `/${slug}`, title, description });
}
