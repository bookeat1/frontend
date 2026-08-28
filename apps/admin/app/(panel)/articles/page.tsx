"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { GuideCollectionDetailView } from "@/components/gastroguide/GuideCollectionDetailView";
import { GuideCollectionsView } from "@/components/gastroguide/GuideCollectionsView";
import { LoadingState } from "@/components/StateViews";

/**
 * «Статьи» — тот же экран, что и `/gastroguide`, но с `kind="article"`.
 *
 * Статья и подборка гастрогида — разные сущности (решение владельца
 * 2026-08-28), но у редактора это одна и та же работа: заголовок, обложка,
 * список заведений, публикация. Поэтому раздела два, а экран один
 * (`GuideCollectionsView` параметризован видом) — форк второго почти такого же
 * экрана разошёлся бы на первой же правке.
 *
 * Выбор записи — через `?collection=<id>`, как на `/gastroguide`: панель
 * собирается статикой (`output: "export"`), и динамический сегмент потребовал
 * бы знать все id на этапе сборки.
 */
function ArticlesScreen() {
  const articleId = useSearchParams().get("collection");
  return articleId ? (
    <GuideCollectionDetailView collectionId={articleId} />
  ) : (
    <GuideCollectionsView kind="article" />
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ArticlesScreen />
    </Suspense>
  );
}
