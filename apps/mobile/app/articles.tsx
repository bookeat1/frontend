import { colors, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ArticleListCard } from "../src/components/articles/ArticleListCard";
import { GuideCategoryGrid } from "../src/components/articles/GuideCategoryGrid";
import { GUIDE_HERO_CONTENT_HEIGHT, GuideHero } from "../src/components/articles/GuideHero";
import {
  categoriesWithCollections,
  filterCollectionsByCategory,
} from "../src/components/articles/guide-categories";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { DataErrorState } from "../src/components/DataErrorState";
import { SectionHeader } from "../src/components/explore/SectionCard";
import {
  useGuideCategories,
  useGuideCollections,
} from "../src/components/explore/use-explore-data";
import { EmptyState, LoadingState } from "../src/components/StateViews";

const t = getDictionary();

/**
 * «Гастрогид» — корень четвёртой вкладки (макет dVjT37j984ErvOmzxlx29p,
 * node 1099:6800). Сверху фотография города со слоганом, ниже один белый блок
 * «Подборки»: сетка рубрик и под ней карточки подборок
 * (`GET /gastroguide/collections`).
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ:
 *
 *  - «Гастропрогулки» (вторая секция макета, node 1099:6892) не собрана вовсе:
 *    сущности «маршрут» в бэкенде нет ни в каком виде, наполнять карточки
 *    нечем, а нарисованные от руки маршруты были бы выдумкой;
 *  - сетка рубрик рисуется только когда `GET /gastroguide/categories` что-то
 *    вернул. На проде на 2026-08-20 она отдаёт пустой список, поэтому сетки
 *    сейчас не видно — и это правильнее плиток-заглушек;
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
  const categoriesQuery = useGuideCategories();
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const [heroBehindStatusBar, setHeroBehindStatusBar] = useState(true);

  const collections = useMemo(() => collectionsQuery.data ?? [], [collectionsQuery.data]);

  // Рубрики без подборок не показываем: плитка, отбирающая пустоту, — мёртвый
  // контрол. Отказ ручки рубрик экран не роняет, сетка просто не появляется.
  const rubrics = useMemo(
    () => categoriesWithCollections(categoriesQuery.data ?? [], collections),
    [categoriesQuery.data, collections],
  );

  // Выбранная рубрика ВЫВОДИТСЯ, а не хранится как есть: подборки могли
  // обновиться и рубрика исчезнуть, и тогда отбор по ней оставил бы гостя с
  // пустым экраном без объяснений.
  const selectedSlug = rubrics.some((rubric) => rubric.slug === pickedSlug) ? pickedSlug : null;

  const visibleCollections = useMemo(
    () => filterCollectionsByCategory(collections, selectedSlug),
    [collections, selectedSlug],
  );

  const openArticle = useCallback((slug: string) => router.push(`/articles/${slug}`), [router]);
  const toggleRubric = useCallback(
    (slug: string) => setPickedSlug((current) => (current === slug ? null : slug)),
    [],
  );

  // Стрелка «назад» только там, где есть куда возвращаться: на корне вкладки
  // (гость пришёл по нижней навигации) её быть не должно, при заходе с главной
  // по шеврону «Статьи» — должна.
  const onBack = router.canGoBack() ? () => router.back() : undefined;

  return (
    <View style={styles.root}>
      {/* Часы и заряд белые, пока под ними фотография шапки, и тёмные, когда
          она уехала вверх — тот же приём, что на главной. */}
      <StatusBar style={heroBehindStatusBar ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: navPad }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const passed = event.nativeEvent.contentOffset.y > GUIDE_HERO_CONTENT_HEIGHT;
          if (passed === heroBehindStatusBar) setHeroBehindStatusBar(!passed);
        }}
      >
        <GuideHero title={t.nav.gastroguide} headline={t.articles.guideHeadline} onBack={onBack} />

        <View style={styles.section}>
          <SectionHeader title={t.articles.rubricsTitle} size="large" />

          {rubrics.length > 0 ? (
            <View style={styles.gridWrap}>
              <GuideCategoryGrid
                categories={rubrics}
                selectedSlug={selectedSlug}
                onToggle={toggleRubric}
              />
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
          ) : visibleCollections.length === 0 ? (
            <EmptyState
              title={t.articles.emptyTitle}
              description={t.articles.emptyDescription}
              compact
            />
          ) : (
            <View style={styles.list}>
              {visibleCollections.map((collection) => (
                <ArticleListCard
                  key={collection.slug}
                  collection={collection}
                  onPress={openArticle}
                />
              ))}
            </View>
          )}
        </View>
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
