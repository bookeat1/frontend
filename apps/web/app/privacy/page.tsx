import { buildSitePageRoute } from "@web/lib/seo/site-page-route";

/**
 * T1/T3/T4: серверный рендер + метаданные — см. site-page-route.tsx.
 *
 * `revalidate` — литерал ОБЯЗАТЕЛЬНО прямо здесь: сборщик Next разбирает
 * `export const revalidate` по AST страницы и не умеет вычислить ни
 * обращение к полю объекта, ни импортированный идентификатор (оба варианта
 * уронили `next build` с «Invalid segment configuration export» — см.
 * site-page-route.tsx).
 */
const route = buildSitePageRoute("privacy");
export const generateMetadata = route.generateMetadata;
export const revalidate = 3600;
export default route.Page;
