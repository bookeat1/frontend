import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { ArticleCard } from "./ArticleCard";
import { CardStrip } from "./CardStrip";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useExploreArticles } from "./use-explore-data";

const t = getDictionary();

/**
 * «Статьи» — editorial cards.
 *
 * GRACEFUL EMPTY STATE: there is no articles endpoint yet
 * (`useExploreArticles` returns [] with a TODO), so this renders NOTHING —
 * header and white block included. It owns its own `SectionCard`, so hiding it
 * leaves no empty block in the screen's stack; the moment the hook returns real
 * articles the section appears with no other change.
 */
export function ArticlesSection() {
  const articles = useExploreArticles();

  if (articles.length === 0) {
    return null;
  }

  return (
    <SectionCard>
      <SectionHeader title={t.explore.articlesTitle} />
      <CardStrip
        data={articles}
        keyExtractor={(article) => article.id}
        accessibilityLabel={t.explore.articlesTitle}
        renderItem={({ item }) => <ArticleCard article={item} />}
      />
    </SectionCard>
  );
}
