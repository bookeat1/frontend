import type { DayOfWeek, Restaurant, VenueSchedule } from "@bookeat/api/client";

import { absoluteUrl, siteUrl } from "@web/lib/site";

/**
 * Сборщики JSON-LD (SEO T4, `web-ai-search-visibility-20260918.md`, §5.1,
 * критерии C19-C23). Чистые функции без сети — принимают уже загруженные
 * данные экрана, тестируются без стенда.
 *
 * Схема: любой узел — обычный объект. Строгой библиотеки типов schema.org в
 * монорепозитории нет, а заводить её ради шести форм разметки дороже, чем
 * проверить форму юнит-тестом и `validator.schema.org` руками (T6).
 */
export type JsonLdNode = Record<string, unknown>;

/** Логотип — `apple-icon.png` (180×180), решение 🟡3 спеки: он единственный
 * файл в репозитории ≥ 112×112 из тех, что уже показывались владельцу. */
const LOGO_PATH = "/apple-icon.png";

/**
 * `Organization` + `WebSite` — в `<head>` КАЖДОЙ страницы (root layout),
 * критерий C19.
 *
 * `legalName` НЕ выводится (решение 🟡2 спеки): PRD называет
 * «ТОО «BookEat Technologies»», подвал сайта — «ТОО «Букит»», расхождение не
 * снято, и печатать любое из двух в структурированных данных значило бы
 * заявить юрлицо, которое не подтверждено.
 */
export function organizationGraph(): JsonLdNode[] {
  const organization: JsonLdNode = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "BookEat",
    url: siteUrl,
    logo: absoluteUrl(LOGO_PATH),
  };
  const website: JsonLdNode = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: "BookEat",
    inLanguage: "ru",
    publisher: { "@id": `${siteUrl}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/venues?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return [organization, website];
}

/** `<html>`-обёртка `@graph` — один `<script>` на страницу вместо нескольких. */
export function graph(nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}

const SCHEMA_WEEKDAY: Record<DayOfWeek, string> = {
  0: "https://schema.org/Sunday",
  1: "https://schema.org/Monday",
  2: "https://schema.org/Tuesday",
  3: "https://schema.org/Wednesday",
  4: "https://schema.org/Thursday",
  5: "https://schema.org/Friday",
  6: "https://schema.org/Saturday",
};

function openingHoursSpecification(schedule: VenueSchedule | null): JsonLdNode[] | undefined {
  if (!schedule) return undefined;
  const rows = schedule.days
    .filter((day) => day.isOpen && day.opensAt && day.closesAt)
    .map((day) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_WEEKDAY[day.dayOfWeek],
      opens: day.opensAt as string,
      closes: day.closesAt as string,
    }));
  return rows.length > 0 ? rows : undefined;
}

/**
 * Казахстанский номер к `+7XXXXXXXXXX` ТОЛЬКО для разметки (решение 🟡7
 * спеки) — видимый текст телефона это правило не трогает. Номер, который не
 * похож на казахстанский мобильный/городской (не 10-11 цифр), в разметку не
 * идёт: придуманный телефон хуже отсутствующего.
 */
export function normalizePhoneForJsonLd(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+7${digits}`;
  return undefined;
}

/**
 * `Restaurant` — критерий C20. Поля из спеки, условные блоки ТОЛЬКО когда
 * данные реально есть (координаты 8/22, меню 21/22, соцсети не у всех):
 * отсутствие поля честнее выдуманного значения.
 */
export function restaurantJsonLd(venue: Restaurant): JsonLdNode {
  const url = absoluteUrl(`/venues/${venue.id}`);
  const node: JsonLdNode = {
    "@type": "Restaurant",
    "@id": `${url}#restaurant`,
    name: venue.name,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.address,
      addressLocality: venue.city,
      addressCountry: "KZ",
    },
    servesCuisine: venue.cuisines.map((cuisine) => cuisine.name),
    priceRange: venue.priceLevel,
    image: [venue.coverPhoto, ...venue.photos]
      .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo?.uri))
      .map((photo) => photo.uri)
      .filter((uri, index, all) => all.indexOf(uri) === index),
    description: venue.description || undefined,
    acceptsReservations: venue.acceptsOnlineBookings ? absoluteUrl(`/venues/${venue.id}/book`) : false,
  };

  const phone = normalizePhoneForJsonLd(venue.phone);
  if (phone) node.telephone = phone;

  if (venue.latitude !== undefined && venue.longitude !== undefined) {
    node.geo = { "@type": "GeoCoordinates", latitude: venue.latitude, longitude: venue.longitude };
  }

  const hours = openingHoursSpecification(venue.schedule);
  if (hours) node.openingHoursSpecification = hours;

  if (venue.menuHighlights.length > 0) {
    node.hasMenu = absoluteUrl(`/venues/${venue.id}/menu`);
  }

  const sameAs = [venue.social?.website, venue.social?.instagram, venue.social?.whatsapp].filter(
    (link): link is string => Boolean(link),
  );
  if (sameAs.length > 0) node.sameAs = sameAs;

  // aggregateRating ТОЛЬКО при count > 0 (критерий C21) — сегодня 0 у всех
  // 22 заведений прода (`GET /restaurants/:id/reviews/summary`).
  if (venue.reviewsCount > 0) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: venue.rating,
      reviewCount: venue.reviewsCount,
      bestRating: 5,
    };
  }

  return node;
}

/** `BreadcrumbList` — «Главная / {город} / Заведения / {название}», критерий C20. */
export function breadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; path?: string }>,
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(item.path) } : {}),
    })),
  };
}

/** `ItemList` для листингов (`/venues`, `/events`) — критерий C22. */
export function itemListJsonLd(
  items: ReadonlyArray<{ id: string; name: string }>,
  pathFor: (id: string) => string,
): JsonLdNode {
  return {
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(pathFor(item.id)),
    })),
  };
}
