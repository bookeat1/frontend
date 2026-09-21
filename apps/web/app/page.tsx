import type { Metadata } from "next";

import { HomeScreen } from "@web/components/home/HomeScreen";
import { DEFAULT_CITY } from "@web/lib/default-city";
import { homeMetadata } from "@web/lib/seo/metadata";
import { searchVenuesForSsr } from "@web/lib/seo/server-repository";

/**
 * Главная страница сайта — SEO T1/T3 (`web-ai-search-visibility-20260918.md`).
 *
 * СЕРВЕРНО заполняется только раздел «Все заведения в {город}»: он не
 * персонализирован (обычный `searchRestaurants`), в отличие от «Выбрали для
 * вас» — тот спека явно оставляет клиентским («персональные блоки
 * рендерятся только на клиенте», §6). Город — `DEFAULT_CITY` («Алматы»): это
 * ровно то значение, которое покажет `useCity()` на первом клиентском
 * рендере ДО эффектов (см. `lib/city.tsx`), поэтому `initialData` совпадает с
 * ключом запроса без расхождений гидратации.
 *
 * ЧЕСТНО ПРО ОГРАНИЧЕНИЕ (не проверено вживую, отчёт задачи): секция
 * показывает `HOME_CATALOG_LIMIT = 4` карточки по дизайну (Figma, менять без
 * слова владельца нельзя), а критерий A-2 спеки просит ≥ 8 имён в HTML.
 * Здесь SSR даёт эти 4 без ожидания JS; до полных 8 нужно отдельное решение
 * продукта (увеличить лимит или добавить второй неперсонализированный блок).
 */
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const result = await searchVenuesForSsr(DEFAULT_CITY);
  return homeMetadata(result, DEFAULT_CITY);
}

export default async function HomePage() {
  const result = await searchVenuesForSsr(DEFAULT_CITY);
  return <HomeScreen initialCatalog={result ?? undefined} />;
}
