import type { Metadata } from "next";
import type { PlatformPageSlug } from "@bookeat/api/client";

import { SitePageScreen } from "@web/components/pages/SitePageScreen";
import { getPageForSsr } from "@web/lib/seo/server-repository";
import { pageMetadata } from "@web/lib/seo/metadata";

/**
 * Одна фабрика на все семь текстовых страниц (T1/T3, `about`, `jobs`,
 * `contacts`, `how-it-works`, `cancellation`, `offer`, `privacy`) — каждый
 * `app/<slug>/page.tsx` отличался только слагом ДО этой задачи, и семь
 * копий одного и того же `generateMetadata`/серверного чтения были бы семью
 * местами для одной и той же будущей правки.
 *
 * `revalidate` (окно ISR текстовых страниц, спека 🟡5 — 3600 c: суперадмин
 * правит их редко, час задержки для робота не важен) НЕ экспортируется
 * отсюда: каждый `page.tsx` пишет `export const revalidate = 3600;`
 * литералом сам. Сборщик Next разбирает `export const revalidate` по AST
 * страницы на этапе анализа и не умеет вычислить ни обращение к полю
 * объекта (`route.revalidate`), ни импортированный идентификатор — оба
 * варианта роняли `next build` с «Invalid segment configuration export».
 */
export function buildSitePageRoute(slug: PlatformPageSlug) {
  async function generateMetadata(): Promise<Metadata> {
    const page = await getPageForSsr(slug);
    return pageMetadata(slug, page);
  }

  async function Page() {
    const page = await getPageForSsr(slug);
    return <SitePageScreen slug={slug} initialPage={page ?? undefined} />;
  }

  return { generateMetadata, Page };
}
