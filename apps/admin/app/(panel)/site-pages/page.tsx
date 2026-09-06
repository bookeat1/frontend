"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PLATFORM_PAGE_SLUGS, type PlatformPageSlug } from "@bookeat/api/admin";

import { SitePagesView } from "@/components/site-pages/SitePagesView";
import { LoadingState } from "@/components/StateViews";

function isPlatformPageSlug(value: string | null): value is PlatformPageSlug {
  return value !== null && (PLATFORM_PAGE_SLUGS as readonly string[]).includes(value);
}

/**
 * Список и редактор одной из семи страниц сайта живут на одном маршруте —
 * `?page=<slug>` выбирает запись, как у гастропрогулок и статей: панель
 * собирается статикой (`output: "export"`), динамический сегмент `[slug]`
 * потребовал бы знать слаги на этапе сборки.
 *
 * Незнакомый или отсутствующий `?page=` — список, а не ошибка: аллоулист
 * фиксирован, и случайно набранный в адресной строке мусор не должен уводить
 * суперадмина в пустой экран.
 */
function SitePagesScreen() {
  const page = useSearchParams().get("page");
  return <SitePagesView slug={isPlatformPageSlug(page) ? page : null} />;
}

export default function SitePagesPage() {
  // useSearchParams приостанавливает рендер при пререндере; без границы
  // экспорт страницы падает вместо отката на fallback.
  return (
    <Suspense fallback={<LoadingState />}>
      <SitePagesScreen />
    </Suspense>
  );
}
