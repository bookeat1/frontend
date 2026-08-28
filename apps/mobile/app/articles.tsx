import { colors, listCard, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArticleListCard } from "../src/components/articles/ArticleListCard";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { useArticles } from "../src/components/explore/use-explore-data";
import { FlowHeader } from "../src/components/FlowHeader";
import { usePullToRefresh } from "../src/hooks/usePullToRefresh";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { trackEvent } from "../src/lib/analytics";

const t = getDictionary();

/**
 * «Статьи» — экран-список редакционных статей (`GET /articles`), куда ведёт
 * шеврон «Смотреть все» с главной.
 *
 * ЭТО НЕ ГАСТРОГИД. До 2026-08-28 адрес `/articles` был корнем вкладки
 * гастрогида, и раздел «Статьи» на главной открывал именно её — владелец
 * опознал это как баг и развёл сущности: подборки с рубриками остались в
 * гастрогиде (`/gastroguide`), статьи без рубрик живут здесь и открываются по
 * `/articles/:slug`. Ручки тоже разные, поэтому показать подборку этот экран
 * не может физически.
 *
 * Собран как «Акции» и «Афиша» (app/promotions.tsx, app/events.tsx): шапка со
 * стрелкой назад, вертикальная стопка карточек `ListMediaCard` во всю ширину,
 * те же четыре состояния и тот же жест обновления. Своей раскладки у экрана
 * нет намеренно.
 *
 * Читает ТОТ ЖЕ запрос, что и лента на главной, — значит приход сюда попадает
 * в кэш и два экрана не могут разойтись. Пустой ответ — это нормальное «ничего
 * не опубликовали», а не ошибка: спокойное пустое состояние без кнопки, которая
 * лишь перезапросила бы ту же пустую ленту (потянуть жестом при этом можно).
 */
export default function ArticlesScreen() {
  const navPad = useNavBarSpacing();
  const router = useRouter();
  const query = useArticles();
  const articles = query.data ?? [];
  // Один запрос — но состояние индикатора своё (см. usePullToRefresh):
  // `isRefetching` гаснет и на фоновых перезапросах, к которым гость руки не
  // прикладывал.
  const { refreshing, onRefresh } = usePullToRefresh(() => query.refetch());

  const openArticle = useCallback(
    (slug: string) => {
      trackEvent("article_tap", { slug });
      router.push(`/articles/${slug}`);
    },
    [router],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.articles.title} onBack={() => router.back()} />
      </SafeAreaView>

      {query.isLoading ? (
        <LoadingState title={t.articles.loading} />
      ) : query.isError ? (
        <ErrorState
          title={t.articles.errorTitle}
          description={t.articles.errorDescription}
          action={{ label: t.common.retry, onPress: () => query.refetch(), variant: "button" }}
        />
      ) : articles.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.stateContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <EmptyState title={t.articles.emptyTitle} description={t.articles.emptyDescription} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: navPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {articles.map((article) => (
            <ArticleListCard key={article.slug} article={article} onPress={openArticle} />
          ))}
        </ScrollView>
      )}

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  stateContent: {
    // Пустое состояние занимает ленту целиком — иначе его нечем тянуть.
    flexGrow: 1,
  },
  listContent: {
    // Те же отступы, что у списка акций: карточка держит границу сама.
    paddingHorizontal: listCard.listPadding,
    paddingTop: spacing.lg,
    gap: listCard.gap,
    paddingBottom: spacing.xxxl,
  },
});
