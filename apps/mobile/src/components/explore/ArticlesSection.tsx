import { spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ArticleCard } from "./ArticleCard";
import { CardStrip } from "./CardStrip";
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

  // Раскладка из макета (node 3102:12122): первая статья во всю ширину блока,
  // остальные — горизонтальной лентой под ней, через 32. Ровно та же пара
  // «крупная карточка + лента», что у акций и афиши, — правка владельца
  // 2026-08-28 («статьи должны выглядеть как афиши и акции»). БЫЛО: сетка по
  // две карточки в ряд по старому макету 986:8697.
  //
  // Не больше ARTICLES_ON_HOME: главная — витрина, а не архив. Остальное
  // открывается по «Смотреть все», и именно поэтому заголовок ведёт туда.
  const shown = articles.slice(0, ARTICLES_ON_HOME);
  const [lead, ...rest] = shown;

  return (
    <SectionCard>
      <SectionHeader title={t.explore.articlesTitle} onSeeAll={onSeeAll} />
      <View style={styles.column}>
        {/* Отступы 16 стоят у ПЕРВОЙ карточки, а не у всей колонки: лента ниже
            ставит свои внутри `CardStrip` и должна уезжать под правый край. */}
        <View style={styles.lead}>
          <ArticleCard article={lead} onPress={() => onOpenArticle(lead.id)} variant="full" />
        </View>

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
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  /** Просвет между первой статьёй и лентой — 32 (node 3102:12122). */
  column: {
    gap: spacing.xxxl,
  },
  lead: {
    paddingHorizontal: spacing.lg,
  },
});
