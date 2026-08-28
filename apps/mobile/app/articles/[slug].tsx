import { useLocalSearchParams } from "expo-router";
import React from "react";
import { GuideCollectionScreen } from "../../src/components/articles/GuideCollectionScreen";
import { useArticle } from "../../src/components/explore/use-explore-data";

/**
 * Страница ОДНОЙ СТАТЬИ — `GET /articles/:slug`.
 *
 * Сюда ведут карточки раздела «Статьи» (главная и экран-список `/articles`) и
 * ничто больше: на экран гастрогида этот маршрут не выходит — ровно тот баг,
 * который владелец и просил починить.
 *
 * СТАРЫЕ ССЫЛКИ НЕ ЛОМАЮТСЯ: ручка `/articles/:slug` резолвит слаг любого
 * вида (слаг уникален глобально), поэтому deep link на подборку, разосланный
 * до разделения, откроет её здесь, а не покажет «не найдено».
 *
 * Верстка общая с подборкой (`GuideCollectionScreen`): форма ответа у обеих
 * детальных ручек одна.
 */
export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <GuideCollectionScreen query={useArticle(slug)} />;
}
