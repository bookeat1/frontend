import type { Metadata } from "next";
import { Suspense } from "react";

import { CatalogScreen } from "@web/components/catalog/CatalogScreen";
import { CatalogFallback } from "@web/components/catalog/CatalogFallback";
import { DEFAULT_CITY } from "@web/lib/default-city";
import { catalogMetadata } from "@web/lib/seo/metadata";
import { searchVenuesForSsr } from "@web/lib/seo/server-repository";

/**
 * Листинг заведений. `useSearchParams` в клиентском дереве требует границы
 * Suspense — иначе Next не может отрисовать страницу заранее и валит сборку.
 *
 * У границы есть запасная разметка, и это не формальность: без неё до
 * выполнения JS страница была бы пустым белым листом — ни шапки, ни подвала.
 *
 * НЕ СДЕЛАНО этой задачей (честно, отчёт T1): сама выдача (карточки
 * заведений) по-прежнему рендерится клиентом внутри `CatalogScreen` —
 * листинг читает фильтры из адресной строки через `useSearchParams`, и
 * повторить точный ключ запроса на сервере для произвольных query-параметров
 * не поместилось в бюджет задачи. Метаданные (заголовок, описание,
 * canonical) ниже уже серверные и не зависят от контента карточек.
 */
export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const result = await searchVenuesForSsr(DEFAULT_CITY);
  return catalogMetadata(result);
}

export default function VenuesPage() {
  return (
    <Suspense fallback={<CatalogFallback />}>
      <CatalogScreen />
    </Suspense>
  );
}
