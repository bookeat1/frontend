import type { MetadataRoute } from "next";
import { EMPTY_FILTERS, HttpRestaurantRepository } from "@bookeat/api/client";

import { buildSitemapEntries, EMPTY_SOURCES, type SitemapSources } from "@web/lib/sitemap-entries";

/**
 * `/sitemap.xml`. Статические страницы плюс то, что реально есть в каталоге:
 * заведения (карточка и меню), предстоящие события, статьи гастрогида.
 *
 * Пересобирается раз в час (ISR): роботы ходят редко, а каждая сборка — три
 * запроса к API. Кэш ISR лежит в `.next/cache`, который на сервере смонтирован
 * tmpfs (см. deploy/web-prod/docker-compose.yml) — релизное дерево read-only.
 *
 * Любой сбой API НЕ валит sitemap: отдаём статические маршруты и то, что
 * успели получить, и пишем предупреждение в лог. Пустой sitemap хуже
 * неполного, а 500 на sitemap.xml — хуже пустого.
 *
 * Что пока НЕ входит и почему: акции (`/promos/:id`) и маршруты гида
 * (`/routes/:slug`) отдаются API только по городу — нужен обход `GET /cities`
 * и N запросов; добавить, когда появится общий листинг.
 */
export const revalidate = 3600;

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();

/** Верхняя граница страниц на источник — защита от бесконечного цикла при странном `pages`. */
const MAX_PAGES = 10;
/** Серверный потолок `per_page` у обоих листингов — 100. */
const PAGE_SIZE = 100;

/**
 * Свой экземпляр, а не `repository` из `lib/api.ts`: тот привязан к сессии
 * гостя в браузере (токен из localStorage, обработчик 401), а здесь — сервер,
 * анонимные публичные ручки и русская локаль (в sitemap язык не важен, но
 * заголовок Accept-Language сервер требует непустым).
 */
function publicRepository(): HttpRestaurantRepository | null {
  if (!API_URL) return null;
  return new HttpRestaurantRepository({ baseUrl: API_URL, getLanguage: () => "ru" });
}

async function collectVenueIds(repo: HttpRestaurantRepository): Promise<string[]> {
  // Поиск без фильтров = весь активный каталог; одна страница на 100 — сегодня
  // это весь список (см. комментарий к searchRestaurants в @bookeat/api).
  const result = await repo.searchRestaurants({ text: "", filters: EMPTY_FILTERS });
  return result.items.map((r) => r.id);
}

async function collectEventIds(repo: HttpRestaurantRepository): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const chunk = await repo.listUpcomingEvents({ page, perPage: PAGE_SIZE });
    ids.push(...chunk.items.map((e) => e.id));
    if (page >= chunk.pages) break;
  }
  return ids;
}

async function collectArticleSlugs(repo: HttpRestaurantRepository): Promise<string[]> {
  const articles = await repo.listArticles();
  return articles.map((a) => a.slug);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = publicRepository();
  if (!repo) {
    console.warn("sitemap: NEXT_PUBLIC_API_URL is not set; emitting static routes only");
    return buildSitemapEntries(EMPTY_SOURCES);
  }

  const [venues, events, articles] = await Promise.allSettled([
    collectVenueIds(repo),
    collectEventIds(repo),
    collectArticleSlugs(repo),
  ]);

  const pick = (name: string, r: PromiseSettledResult<string[]>): string[] => {
    if (r.status === "fulfilled") return r.value;
    console.warn(`sitemap: ${name} unavailable, omitted from this build:`, r.reason);
    return [];
  };

  const sources: SitemapSources = {
    venueIds: pick("venues", venues),
    eventIds: pick("events", events),
    articleSlugs: pick("articles", articles),
  };
  return buildSitemapEntries(sources);
}
