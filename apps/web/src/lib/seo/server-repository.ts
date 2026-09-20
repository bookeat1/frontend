import { unstable_noStore as noStore } from "next/cache";
import {
  EMPTY_FILTERS,
  HttpRestaurantRepository,
  type PlatformPage,
  type PlatformPageSlug,
  type Restaurant,
  type SearchResult,
} from "@bookeat/api/client";

import { isNotFound } from "@web/lib/not-found";

/**
 * Данные для серверного рендера (SEO T1) и для `app/sitemap.ts`.
 *
 * ОДИН репозиторий на оба назначения — раньше `publicRepository()` жил только
 * внутри `app/sitemap.ts` (спека `web-ai-search-visibility-20260918.md`,
 * §5.1, требует вынести). Свой экземпляр, а не `repository` из `lib/api.ts`:
 * тот привязан к сессии гостя в браузере (токен из localStorage, обработчик
 * 401), а здесь — сервер, анонимные публичные ручки, русская локаль (единственный
 * язык, который сегодня уходит роботам, см. «Принятые допущения» спеки).
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();

export function publicRepository(): HttpRestaurantRepository | null {
  if (!API_URL) return null;
  return new HttpRestaurantRepository({ baseUrl: API_URL, getLanguage: () => "ru" });
}

/**
 * Оборачивает вызов, которому нельзя попасть в ISR-кэш пустым или сломанным.
 *
 * ПРАВИЛО A-9 спеки: сбой API при рендере обязан отдать 200 с каркасом
 * (клиент сам сходит за данными), но этот конкретный ответ НЕ должен
 * заморозиться в кэше на всё окно `revalidate` — иначе робот часами видит
 * пустую страницу. `unstable_noStore()` помечает ТЕКУЩИЙ рендер как
 * динамический: следующий запрос (после починки API) снова попробует
 * получить полные данные, а не будет ждать истечения окна.
 *
 * Для маршрутов БЕЗ `generateStaticParams` (главная, листинг, семь текстовых
 * страниц) — там страница уже целиком пререндерена статически (см.
 * `generateStaticParams`-less ISR: маршрут собирается один раз на build,
 * фоновая ревалидация при ошибке ловится самим Next и откатывается на
 * прошлый успешный кэш, `noStore()` внутри неё безопасен), И для
 * `/venues/[id]`, который с 2026-09-19 вообще не участвует в ISR
 * (`export const dynamic = "force-dynamic"` в `page.tsx`) — там `noStore()`
 * не более чем не-op поверх уже динамического рендера.
 *
 * 404 — это не сбой, а ответ «такой записи нет»: пробрасывается КАК ЕСТЬ,
 * чтобы вызывающая `page.tsx` могла позвать `notFound()` (A-8).
 */
async function fetchOrNull<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (isNotFound(error)) throw error;
    noStore();
    console.warn(`ssr: ${label} failed, falling back to client-side fetch`, error);
    return null;
  }
}

/**
 * Заведение для `/venues/[id]`. `null` — сбой API (страница рисует каркас,
 * клиент сам перезапросит); бросает исходную ошибку при 404 — вызывающий код
 * обязан позвать `notFound()`.
 *
 * БЕЗ кэша (правка ревью 3го круга, 2026-09-19): раньше здесь был
 * `unstable_cache` на 600 секунд (`cachedOrNull`) — успешный ответ
 * замораживался в Data Cache Next.js, и если заведение деактивировалось
 * между рендерами, до 10 минут отдавался старый 200 с мёртвым контентом
 * вместо немедленного 404. Владелец продукта решил снять ISR с этой
 * страницы совсем, а не подгонять таймер — читаем API напрямую на каждый
 * запрос (`app/venues/[id]/page.tsx` теперь `dynamic = "force-dynamic"`).
 */
export async function getVenueForSsr(id: string): Promise<Restaurant | null> {
  const repo = publicRepository();
  if (!repo) return null;
  return fetchOrNull(`getRestaurant(${id})`, () => repo.getRestaurant(id));
}

/**
 * Первая страница каталога без фильтров — «Все заведения» на главной
 * (`HomeScreen.tsx`, до 100 записей, как у `useCatalog` без пагинации на
 * сервере). Используется ТОЛЬКО когда состояние листинга совпадает с тем, что
 * получит первый клиентский рендер (см. комментарий у `useCatalog` в
 * `lib/queries.ts`) — сегодня это главная страница с городом по умолчанию.
 */
export async function searchVenuesForSsr(city: string): Promise<SearchResult | null> {
  const repo = publicRepository();
  if (!repo) return null;
  return fetchOrNull("searchRestaurants", () =>
    repo.searchRestaurants({ text: "", filters: { ...EMPTY_FILTERS, city } }),
  );
}

/**
 * Текстовая страница (`/about`, `/how-it-works`, …). `null` — сбой API ИЛИ
 * страница не опубликована (404): для этих семи страниц спека не требует
 * настоящего HTTP 404 (в отличие от заведений/событий/статей/акций, A-8), так
 * что оба случая одинаково откатываются на клиентский запрос и его же
 * состояние «не найдено» (`SitePageScreen`).
 */
export async function getPageForSsr(slug: PlatformPageSlug): Promise<PlatformPage | null> {
  const repo = publicRepository();
  if (!repo) return null;
  try {
    return await repo.getPage(slug);
  } catch (error) {
    if (!isNotFound(error)) noStore();
    return null;
  }
}
