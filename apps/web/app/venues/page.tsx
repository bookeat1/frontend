import { Suspense } from "react";

import { CatalogScreen } from "@web/components/catalog/CatalogScreen";
import { CatalogFallback } from "@web/components/catalog/CatalogFallback";

/**
 * Листинг заведений. `useSearchParams` в клиентском дереве требует границы
 * Suspense — иначе Next не может отрисовать страницу заранее и валит сборку.
 *
 * У границы есть запасная разметка, и это не формальность: без неё до
 * выполнения JS страница была бы пустым белым листом — ни шапки, ни подвала.
 */
export default function VenuesPage() {
  return (
    <Suspense fallback={<CatalogFallback />}>
      <CatalogScreen />
    </Suspense>
  );
}
