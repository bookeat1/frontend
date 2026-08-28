import { useLocalSearchParams } from "expo-router";
import React from "react";
import { GuideCollectionScreen } from "../../../src/components/articles/GuideCollectionScreen";
import { useGuideCollection } from "../../../src/components/explore/use-explore-data";

/**
 * Страница ОДНОЙ ПОДБОРКИ гастрогида — `GET /gastroguide/collections/:slug`.
 *
 * Сюда ведут карточки «Выбор редакции» с экрана гастрогида и экран рубрики.
 * БЫЛО `/articles/:slug`: до 2026-08-28 подборки и статьи были одной сущностью
 * и жили по одному адресу, из-за чего раздел «Статьи» на главной открывал
 * гастрогид. Теперь `/articles/:slug` — это статья, а подборка переехала сюда.
 *
 * Вся верстка — общая `GuideCollectionScreen`: у детальных ручек подборки и
 * статьи одна и та же форма ответа, и второй копии экрана быть не должно.
 */
export default function GuideCollectionDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <GuideCollectionScreen query={useGuideCollection(slug)} />;
}
