import { spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ArticleCard } from "./ArticleCard";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useExploreArticles } from "./use-explore-data";

const t = getDictionary();

/** Сколько статей помещается на главной. Больше — это уже список, для него
 * есть отдельный экран за «Смотреть все». */
const ARTICLES_ON_HOME = 6;

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

  // Столбиком, по решению владельца (14.08.2026): лента вбок прятала статьи за
  // краем экрана, а крупная первая карточка съедала весь блок. Теперь все
  // карточки одного размера и видны сразу.
  //
  // Не больше ARTICLES_ON_HOME: главная — витрина, а не архив. Остальное
  // открывается по «Смотреть все», и именно поэтому заголовок ведёт туда.
  const shown = articles.slice(0, ARTICLES_ON_HOME);

  return (
    <SectionCard>
      <SectionHeader title={t.explore.articlesTitle} onSeeAll={onSeeAll} />
      <View style={styles.column}>
        {shown.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            onPress={() => onOpenArticle(article.id)}
            featured
          />
        ))}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing.xxl,
    // Секция сама горизонтальных отступов не задаёт (их ставила лента), а
    // фотография во всю ширину экрана упиралась в края — на экране «Статьи»
    // она стоит с отступом.
    paddingHorizontal: spacing.lg,
  },
});
