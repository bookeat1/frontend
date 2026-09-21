import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VenueScreen } from "@web/components/venue/VenueScreen";
import { JsonLdScript } from "@web/components/seo/JsonLdScript";
import { isNotFound } from "@web/lib/not-found";
import { getVenueForSsr } from "@web/lib/seo/server-repository";
import { venueMetadata } from "@web/lib/seo/metadata";
import { breadcrumbJsonLd, graph, restaurantJsonLd } from "@web/lib/seo/jsonld";
import { t } from "@web/lib/i18n";

/**
 * Страница заведения — SEO T1/T3/T4 (`web-ai-search-visibility-20260918.md`).
 *
 * Каталог и робот получают ту же карточку без единого клика JS: заведение
 * читается СЕРВЕРОМ здесь и передаётся в `VenueScreen` как `initialVenue` —
 * TanStack Query подставляет его вместо первого запроса (см. `useVenue` в
 * `lib/queries.ts`), и содержимое стоит в HTML сразу, а не после гидратации.
 *
 * Неизвестный/деактивированный id — настоящий HTTP 404 (`notFound()`,
 * критерий A-8), а не «карточка не найдена» с кодом 200, как было раньше.
 * Сбой самого API (сеть, таймаут) — НЕ 404: страница отдаёт 200 с каркасом
 * (initialVenue не задан, `VenueScreen` идёт в обычный клиентский запрос).
 *
 * БЕЗ ISR (правка ревью 3го круга, 2026-09-19, решение продукта): страница
 * рендерится per-request (`dynamic = "force-dynamic"`), `unstable_cache`
 * больше не используется в `getVenueForSsr`. Раньше `revalidate = 600` +
 * `unstable_cache` кэшировали УСПЕШНЫЙ ответ на 10 минут — если заведение
 * деактивируется между рендерами, до 10 минут отдавался старый 200 с
 * мёртвым/пустым контентом вместо немедленного 404. Владелец продукта решил
 * не подгонять таймер, а снять ISR с этой страницы совсем: on-demand
 * revalidation (revalidatePath по вебхуку на изменение заведения) в проекте
 * пока не существует, заводить его — отдельная задача.
 */
export const dynamic = "force-dynamic";

interface VenuePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const venue = await getVenueForSsr(id);
    return venue ? venueMetadata(venue) : {};
  } catch (error) {
    // 404 здесь молчит: `notFound()` в самой странице отвечает за статус,
    // а generateMetadata на несуществующей странице всё равно не читается.
    if (isNotFound(error)) return {};
    throw error;
  }
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { id } = await params;

  let venue: Awaited<ReturnType<typeof getVenueForSsr>>;
  try {
    venue = await getVenueForSsr(id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }

  return (
    <>
      {venue ? (
        <JsonLdScript
          data={graph([
            restaurantJsonLd(venue),
            breadcrumbJsonLd([
              { name: t.web.venue.breadcrumbHome, path: "/" },
              { name: t.web.venue.breadcrumbVenues, path: "/venues" },
              { name: venue.name },
            ]),
          ])}
        />
      ) : null}
      <VenueScreen id={id} initialVenue={venue ?? undefined} />
    </>
  );
}
