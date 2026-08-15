import { spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ArticleCard } from "./ArticleCard";
import { SectionCard, SectionHeader } from "./SectionCard";
import { type ArticleCardData } from "./placeholder";
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

  // Раскладка из макета 986:8697: первая статья во всю ширину, остальные —
  // парами под ней. Так свежая подборка читается первой, а не теряется среди
  // одинаковых плиток.
  //
  // Не больше ARTICLES_ON_HOME: главная — витрина, а не архив. Остальное
  // открывается по «Смотреть все», и именно поэтому заголовок ведёт туда.
  const shown = articles.slice(0, ARTICLES_ON_HOME);
  const [lead, ...rest] = shown;
  const rows: ArticleCardData[][] = [];
  for (let i = 0; i < rest.length; i += 2) {
    rows.push(rest.slice(i, i + 2));
  }

  return (
    <SectionCard>
      <SectionHeader title={t.explore.articlesTitle} onSeeAll={onSeeAll} />
      <View style={styles.column}>
        <ArticleCard article={lead} onPress={() => onOpenArticle(lead.id)} variant="full" />

        {rows.map((row) => (
          <View key={row[0].id} style={styles.row}>
            {row.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onPress={() => onOpenArticle(article.id)}
                variant="half"
              />
            ))}
            {/* Нечётная последняя карточка остаётся в своей половине, а не
                растягивается на весь ряд: иначе она выглядела бы как ещё одна
                «главная» статья. */}
            {row.length === 1 ? <View style={styles.rowFiller} /> : null}
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rowFiller: {
    flex: 1,
  },
  column: {
    gap: spacing.xxl,
    // Секция сама горизонтальных отступов не задаёт (их ставила лента), а
    // фотография во всю ширину экрана упиралась в края — на экране «Статьи»
    // она стоит с отступом.
    paddingHorizontal: spacing.lg,
  },
});
