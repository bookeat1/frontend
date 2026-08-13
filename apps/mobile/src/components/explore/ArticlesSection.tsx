import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { ArticleCard } from "./ArticleCard";
import { CardStrip } from "./CardStrip";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useExploreArticles } from "./use-explore-data";

const t = getDictionary();

/**
 * «Статьи» — editorial collections (GASTROGUIDE), wired to the live
 * `GET /gastroguide/collections` via `useExploreArticles`.
 *
 * GRACEFUL EMPTY STATE: the hook returns [] while loading, on error, and when
 * nothing is published, so this renders NOTHING (header and white block
 * included). It owns its own `SectionCard`, so hiding it leaves no empty block
 * in the screen's stack. The header chevron opens the full `/articles` list;
 * tapping a card opens `/articles/:slug`.
 */
export function ArticlesSection({
  onSeeAll,
  onOpenArticle,
}: {
  onSeeAll: () => void;
  onOpenArticle: (slug: string) => void;
}) {
  const articles = useExploreArticles();

  if (articles.length === 0) {
    return null;
  }

  // Первая статья — крупной карточкой во всю ширину, остальные лентой под ней
  // (макет 986:8697). Свежая подборка так читается как редакционный материал,
  // а не как ещё одна плитка в общем ряду.
  const [featured, ...rest] = articles;

  return (
    <SectionCard>
      <SectionHeader title={t.explore.articlesTitle} onSeeAll={onSeeAll} />
      <ArticleCard article={featured} onPress={() => onOpenArticle(featured.id)} featured />
      {rest.length > 0 ? (
        <CardStrip
          data={rest}
          keyExtractor={(article) => article.id}
          accessibilityLabel={t.explore.articlesTitle}
          renderItem={({ item }) => (
            <ArticleCard article={item} onPress={() => onOpenArticle(item.id)} />
          )}
        />
      ) : null}
    </SectionCard>
  );
}
