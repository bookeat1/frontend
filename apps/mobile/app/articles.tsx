import { colors, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ArticleListCard } from "../src/components/articles/ArticleListCard";
import { GuideCollectionGrid } from "../src/components/articles/GuideCollectionGrid";
import { GuideRouteCard } from "../src/components/articles/GuideRouteCard";
import { splitGuideCollections } from "../src/components/articles/guide-collections";
import { GUIDE_HERO_CONTENT_HEIGHT, GuideHero } from "../src/components/articles/GuideHero";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { DataErrorState } from "../src/components/DataErrorState";
import { SectionHeader } from "../src/components/explore/SectionCard";
import { useGuideCollections, useGuideRoutes } from "../src/components/explore/use-explore-data";
import { usePullToRefresh } from "../src/hooks/usePullToRefresh";
import { EmptyState, LoadingState } from "../src/components/StateViews";

const t = getDictionary();

/**
 * «Гастрогид» — корень четвёртой вкладки (макет dVjT37j984ErvOmzxlx29p,
 * node 1099:6800). Сверху фотография города со слоганом, ниже один белый блок
 * «Подборки»: сетка плиток и под ней широкие карточки. И сетку, и карточки
 * кормит ОДНА ручка `GET /gastroguide/collections`, одна подборка показывается
 * ровно один раз — правило дележа лежит в `guide-collections.ts`.
 *
 * Ниже вторым белым блоком идут «Гастропрогулки» (node 1099:6892) — отдельная
 * ручка `GET /gastroguide/routes?city=`. Это НЕ подборки: маршрут это
 * последовательность остановок, и среди них есть места, которых нет и не будет
 * в каталоге заведений (парк, базар, Кок-Тобе).
 *
 * БЛОК ЦЕЛИКОМ СКРЫТ, пока маршрутов нет: пустых состояний тут два подряд быть
 * не должно, а «Подборки» уже объясняют человеку, что раздел живой. Ошибка
 * загрузки маршрутов тоже не рушит экран — подборки грузятся своим запросом.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ:
 *
 *  - рубрики (`GET /gastroguide/categories`) этот экран больше не запрашивает:
 *    их DTO несёт только `{id, slug, title, position}`, плитка из него выходила
 *    без фотографии, а нажатие на неё отбирало список — обоих поведений в
 *    продукте быть не должно. Ручка и метод репозитория живы, просто не нужны
 *    здесь;
 *  - сердечка на карточке подборки нет: избранное на бэкенде знает про
 *    заведения, события и акции, но не про подборки (см. ArticleListCard).
 *
 * Шеврон в заголовке секции остаётся декоративным (`SectionHeader` рисует его
 * кнопкой только когда есть `onSeeAll`): этот экран и ЕСТЬ полный список
 * подборок, «показать все» вести некуда.
 *
 * Четыре состояния списка живут ВНУТРИ белого блока, а шапка остаётся на месте
 * всегда: это корень вкладки, и пустой экран вместо раздела выглядел бы как
 * поломка приложения. Пустой ответ — норма («ничего не опубликовали»), а не
 * ошибка; отказ разбирает `DataErrorState` (нет сети / техработы / прочее).
 */
export default function ArticlesScreen() {
  const navPad = useNavBarSpacing();
  const router = useRouter();

  const collectionsQuery = useGuideCollections();
  const routesQuery = useGuideRoutes();
  const [heroBehindStatusBar, setHeroBehindStatusBar] = useState(true);

  // ДВА запроса, и оба принадлежат этому экрану, поэтому предикат по кэшу
  // (как на главной) здесь лишний: обе ручки уже в руках, а `Promise.all`
  // завершается ровно тогда, когда ответил ПОСЛЕДНИЙ из них — кружок не
  // гаснет на первом ответе, пока второй блок ещё едет.
  //
  // Отказ одного не отменяет другой: `refetch()` у react-query не бросает,
  // ошибку рассказывает состояние своего блока.
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([collectionsQuery.refetch(), routesQuery.refetch()]),
  );

  const collections = useMemo(() => collectionsQuery.data ?? [], [collectionsQuery.data]);
  const { rubrics, articles } = useMemo(() => splitGuideCollections(collections), [collections]);

  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);

  const openArticle = useCallback((slug: string) => router.push(`/articles/${slug}`), [router]);
  const openRoute = useCallback((slug: string) => router.push(`/routes/${slug}`), [router]);

  return (
    <View style={styles.root}>
      {/* Часы и заряд белые, пока под ними фотография шапки, и тёмные, когда
          она уехала вверх — тот же приём, что на главной. */}
      <StatusBar style={heroBehindStatusBar ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: navPad }]}
        showsVerticalScrollIndicator={false}
        // Экран — одна лента, и тянется он целиком: и когда подборок нет
        // (пустое состояние живёт ВНУТРИ белого блока, лента остаётся), и
        // когда загрузка сорвалась. Отдельной обёртки под пустое состояние
        // здесь не нужно — фотография шапки сама длиннее экрана.
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const passed = event.nativeEvent.contentOffset.y > GUIDE_HERO_CONTENT_HEIGHT;
          if (passed === heroBehindStatusBar) setHeroBehindStatusBar(!passed);
        }}
      >
        {/* Стрелки «назад» здесь нет НИ ПРИ КАКОМ заходе: это корень вкладки,
            и возвращаться из корня некуда. Раньше она показывалась по
            `router.canGoBack()` — то есть при заходе с главной по шеврону
            «Гастрогид», где в стеке остаётся запись, — и гость видел на
            корневой вкладке кнопку, которая уводила его на другую вкладку.
            У вложенных экранов раздела (`/articles/[slug]`, `/routes/[slug]`)
            стрелка своя и остаётся на месте. */}
        <GuideHero title={t.nav.gastroguide} headline={t.articles.guideHeadline} />

        <View style={styles.section}>
          <SectionHeader title={t.articles.collectionsTitle} />

          {rubrics.length > 0 ? (
            <View style={styles.gridWrap}>
              <GuideCollectionGrid collections={rubrics} onPress={openArticle} />
            </View>
          ) : null}

          {collectionsQuery.isLoading ? (
            <LoadingState title={t.articles.loading} compact />
          ) : collectionsQuery.isError ? (
            <DataErrorState
              error={collectionsQuery.error}
              onRetry={() => void collectionsQuery.refetch()}
              compact
            />
          ) : collections.length === 0 ? (
            <EmptyState
              title={t.articles.emptyTitle}
              description={t.articles.emptyDescription}
              compact
            />
          ) : articles.length > 0 ? (
            <View style={styles.list}>
              {articles.map((collection) => (
                <ArticleListCard
                  key={collection.slug}
                  collection={collection}
                  onPress={openArticle}
                />
              ))}
            </View>
          ) : null}
        </View>

        {routes.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t.articles.routesTitle} />
            <View style={styles.list}>
              {routes.map((route) => (
                <GuideRouteCard key={route.slug} route={route} onPress={openRoute} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  scrollContent: {
    // Просвет 8 между шапкой и белым блоком (node 1099:6801) — серый лист
    // экрана виден в нём полоской, как в макете.
    gap: spacing.sm,
  },
  section: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.contentBlock,
    paddingVertical: spacing.lg,
    gap: spacing.xxl,
  },
  gridWrap: {
    paddingHorizontal: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xxl,
  },
});
