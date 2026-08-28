import type { GuideCollection } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { ListMediaCard } from "../ListMediaCard";

const t = getDictionary();

/**
 * Карточка вертикального списка «Статьи» (экран `/articles`).
 *
 * Геометрия — общая `ListMediaCard`, ровно как у акций (`PromotionListCard`) и
 * у избранного: снимок 198 со скруглением 22, название внутри снимка, под ним
 * одна строка. Своей вёрстки у статьи нет и быть не должно — владелец просил
 * (2026-08-27) держать все листинги в виде страницы поиска.
 *
 * ПОДПИСЬ. Сначала подзаголовок самой статьи — это то, что написала редакция.
 * Когда его нет (на проде такие есть), встаёт постоянная подпись «От BookEat»:
 * автора в ответе нет вовсе, и выдумывать его нельзя, а пустая строка внизу
 * кадра читается как недогруженная карточка.
 */
export function ArticleListCard({
  article,
  onPress,
}: {
  article: GuideCollection;
  onPress: (slug: string) => void;
}) {
  const subtitle = article.subtitle.trim() || t.explore.articleAuthorDefault;

  return (
    <ListMediaCard
      title={article.title}
      subtitle={subtitle}
      coverUri={article.coverImageUrl}
      onPress={() => onPress(article.slug)}
      accessibilityLabel={t.articles.card(article.title, subtitle)}
    />
  );
}
