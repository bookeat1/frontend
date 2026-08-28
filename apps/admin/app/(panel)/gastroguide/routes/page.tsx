"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { GuideRouteDetailView } from "@/components/gastroguide/GuideRouteDetailView";
import { GuideRoutesView } from "@/components/gastroguide/GuideRoutesView";
import { LoadingState } from "@/components/StateViews";

/**
 * Список и карточка прогулки живут на одном маршруте, а сама прогулка
 * выбирается через `?route=<id>`, а не сегментом `[id]` — ровно по той же
 * причине, что и у статей: панель собирается с `output: "export"` и раздаётся
 * Caddy как статика, за ней нет процесса Node. Динамическому сегменту
 * понадобился бы generateStaticParams, то есть набор id на этапе СБОРКИ —
 * именно то, что редактор меняет во время работы.
 *
 * Экран лежит под /gastroguide, поэтому на него распространяется тамошний
 * layout: гастрогид целиком — контент платформы, и открыть его может только
 * суперадмин.
 */
function GastroRoutesScreen() {
  const routeId = useSearchParams().get("route");
  return routeId ? <GuideRouteDetailView routeId={routeId} /> : <GuideRoutesView />;
}

export default function GastroRoutesPage() {
  // useSearchParams приостанавливает рендер при пререндере; без границы
  // экспорт страницы падает вместо отката на fallback.
  return (
    <Suspense fallback={<LoadingState />}>
      <GastroRoutesScreen />
    </Suspense>
  );
}
