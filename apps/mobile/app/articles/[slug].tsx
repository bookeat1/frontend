import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ArticleScreen } from "../../src/components/articles/ArticleScreen";
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
 * ВЕРСТКА БОЛЬШЕ НЕ ОБЩАЯ С ПОДБОРКОЙ (правка владельца 28.08.2026): статья
 * собрана по образцу карточки афиши — фотография во всю ширину, название
 * поверх неё, плавающие кнопки «назад»/«поделиться», те же белые блоки и
 * типографика. Разбор — в `ArticleScreen`. Страница подборки гастрогида
 * осталась на `GuideCollectionScreen` со своим брендовым макетом.
 */
export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ArticleScreen query={useArticle(slug)} />;
}
