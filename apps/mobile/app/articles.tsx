import type { GuideCollection } from "@bookeat/api";
import { colors, guideLayout } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { GuideEditorialCard } from "../src/components/articles/GuideEditorialCard";
import { GuideRubricRail } from "../src/components/articles/GuideRubricRail";
import { GuideSectionHeader } from "../src/components/articles/GuideSectionHeader";
import { splitGuideCollections } from "../src/components/articles/guide-collections";
import { GUIDE_HERO_CONTENT_HEIGHT, GuideHero } from "../src/components/articles/GuideHero";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { DataErrorState } from "../src/components/DataErrorState";
import {
  useGuideCity,
  useGuideCollections,
  useGuideRoutes,
} from "../src/components/explore/use-explore-data";
import { usePullToRefresh } from "../src/hooks/usePullToRefresh";
import { EmptyState, LoadingState } from "../src/components/StateViews";

const t = getDictionary();

/**
 * «Гастрогид» — корень четвёртой вкладки. Макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 3192:6246 «Гастрогид — Editorial v2».
 *
 * ЭКРАН ПЕРЕСОБРАН ЦЕЛИКОМ (2026-08-27, правка владельца «изменил страницы
 * гастрогида полностью, сделай по макету»). Что стало другим:
 *
 *   • лист экрана кремовый (#F7F5F1), а белых блоков-секций больше НЕТ.
 *     Раньше содержимое лежало двумя белыми карточками на сером листе — в
 *     новом макете секции стоят прямо на кремовом фоне, а «карточкой»
 *     становится сама фотография;
 *   • секций стало три вместо двух: «Рубрики» (горизонтальная лента плиток),
 *     «Выбор редакции» и «Гастропрогулки»;
 *   • подписи переехали НА фотографию: и у плитки, и у большой карточки текст
 *     лежит поверх затемнения, а не под кадром;
 *   • заголовки секций набраны Bold 20/28 (узлы 3492:13477, 3492:13479,
 *     3492:13486 — макет перерисован 2026-08-28, до этого стояла
 *     Playfair Display Italic 24). Журнальные засечки остались у слогана
 *     шапки и на странице бренда.
 *
 * ОТКУДА БЕРУТСЯ ДАННЫЕ (ручек по-прежнему две, третьей секции сервер не
 * знает):
 *
 *   • `GET /gastroguide/collections` — одна ручка на «Рубрики» и «Выбор
 *     редакции». Делит их та же редакционная привязка, что и раньше
 *     (`splitGuideCollections`): подборка с рубрикой идёт в ленту, подборка
 *     без рубрики — большой карточкой. Одна подборка показывается ровно один
 *     раз;
 *   • `GET /gastroguide/routes?city=` — «Гастропрогулки». Это НЕ подборки:
 *     маршрут это последовательность остановок, и среди них есть места,
 *     которых нет и не будет в каталоге (парк, базар, Кок-Тобе).
 *
 * ПРО «ВЫБОР РЕДАКЦИИ». В макете под этим заголовком нарисована ОДНА карточка.
 * Лонгридов у редакции бывает больше, и показывать только первый значило бы
 * молча спрятать остальные — под заголовком идут ВСЕ подборки без рубрики,
 * одинаковыми карточками из макета. Отбирать «главную» на клиенте нечем:
 * поля «выбор редакции» в ответе нет.
 *
 * Секция маршрутов СКРЫТА ЦЕЛИКОМ, пока маршрутов нет: двух пустых состояний
 * подряд быть не должно. Отказ этой ручки тоже не рушит экран — подборки
 * грузятся своим запросом.
 *
 * СТРЕЛКИ «НАЗАД» НЕТ, хотя в макете она нарисована (node 3202:6432): это
 * корень вкладки, и возвращаться из корня некуда — см. `GuideHero`.
 */
export default function ArticlesScreen() {
  const navPad = useNavBarSpacing();
  const router = useRouter();

  const collectionsQuery = useGuideCollections();
  const routesQuery = useGuideRoutes();
  const { city } = useGuideCity();
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

  /**
   * Плитка ленты «Рубрики» открывает ЭКРАН РУБРИКИ, а не подборку, из которой
   * она собрана (node 3492:13723): нарисована она как рубрика, и на новом
   * экране лежат заведения всех её подборок.
   *
   * Маршрут строится по ПЕРВОМУ слагу из `categorySlugs` — по нему же плитка
   * подписана золотой надписью. В ленте оказываются только подборки, у которых
   * он есть (`splitGuideCollections`), но если сервер однажды пришлёт пустой
   * список — открывается сама подборка: это хуже по смыслу, но ведёт на живой
   * экран, а не в никуда.
   */
  const openRubric = useCallback(
    (collection: GuideCollection) => {
      const rubric = collection.categorySlugs[0]?.trim();
      router.push(rubric ? `/gastroguide/rubric/${rubric}` : `/articles/${collection.slug}`);
    },
    [router],
  );
  const openRoute = useCallback((slug: string) => router.push(`/routes/${slug}`), [router]);

  return (
    <View style={styles.root}>
      {/* Часы и заряд белые, пока под ними фотография шапки, и тёмные, когда
          она уехала вверх — тот же приём, что на главной. */}
      <StatusBar style={heroBehindStatusBar ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: navPad }}
        showsVerticalScrollIndicator={false}
        // Экран — одна лента, и тянется он целиком: и когда подборок нет, и
        // когда загрузка сорвалась. Фотография шапки сама длиннее экрана.
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const passed = event.nativeEvent.contentOffset.y > GUIDE_HERO_CONTENT_HEIGHT;
          if (passed === heroBehindStatusBar) setHeroBehindStatusBar(!passed);
        }}
      >
        {/* Город в надписи-рубрике и в слогане — тот же, что во всех
            городозависимых запросах экрана (`useGuestCity`), а не зашитая
            «Алматы» из макета: гость, выбравший Астану, увидит Астану. Года
            «2026» из макета в надписи нет — его неоткуда взять, а зашитый год
            протухает молча. */}
        <GuideHero
          title={t.articles.guideBrandTitle(city)}
          eyebrow={t.articles.guideEyebrow(city)}
          headline={t.articles.guideHeadline(city)}
          subline={t.articles.guideSubheadline}
        />

        <View style={styles.content}>
          <View style={styles.section}>
            <GuideSectionHeader title={t.articles.rubricsTitle} />

            {rubrics.length > 0 ? (
              <GuideRubricRail collections={rubrics} onPress={openRubric} />
            ) : null}

            {/* Загрузка, отказ и пустой ответ живут в ПЕРВОЙ секции: она
                кормится той же ручкой, что и «Выбор редакции», и рисовать одно
                и то же состояние дважды незачем. Пустой ответ — норма
                («ничего не опубликовали»), а не ошибка; отказ разбирает
                `DataErrorState` (нет сети / техработы / прочее). */}
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
            ) : null}
          </View>

          {articles.length > 0 ? (
            <View style={styles.section}>
              <GuideSectionHeader title={t.articles.editorPickTitle} />
              <View style={styles.cards}>
                {articles.map((collection) => (
                  <GuideEditorialCard
                    key={collection.slug}
                    variant="editorPick"
                    coverImageUrl={collection.coverImageUrl}
                    // Золотая надпись — подзаголовок подборки заглавными
                    // (в макете на её месте стоит «OCEAN BASKET»). Пустой
                    // подзаголовок означает отсутствие надписи, а не выдуманную:
                    // второго поля под неё в ответе нет.
                    eyebrow={collection.subtitle.trim().toUpperCase() || undefined}
                    title={collection.title}
                    summary={collection.description}
                    accessibilityLabel={
                      collection.description
                        ? t.articles.card(collection.title, collection.description)
                        : collection.title
                    }
                    onPress={() => openArticle(collection.slug)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {routes.length > 0 ? (
            <View style={styles.section}>
              <GuideSectionHeader title={t.articles.routesTitle} />
              <View style={styles.cards}>
                {routes.map((route) => {
                  // Строку под названием пишет РЕДАКЦИЯ («1 день · 4 точки»):
                  // в ней бывает «вечер» или «2 дня · 7 точек», и собирать её
                  // из `pointCount` на клиенте значило бы выкинуть первую
                  // половину. Счёт точек остаётся запасным вариантом.
                  const summary = route.durationLabel || t.articles.routePoints(route.pointCount);
                  return (
                    <GuideEditorialCard
                      key={route.slug}
                      variant="walk"
                      coverImageUrl={route.coverImageUrl}
                      title={route.title}
                      summary={summary}
                      accessibilityLabel={t.articles.card(route.title, summary)}
                      onPress={() => openRoute(route.slug)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Кремовый лист макета (#F7F5F1), а не общий серый экрана: белых
    // блоков-секций на этом экране больше нет, и фон виден целиком.
    backgroundColor: colors.guide.sheet,
  },
  content: {
    paddingTop: guideLayout.contentPaddingTop,
    paddingBottom: guideLayout.contentPaddingBottom,
    paddingHorizontal: guideLayout.contentPaddingHorizontal,
    gap: guideLayout.sectionGap,
  },
  section: {
    gap: guideLayout.sectionHeaderGap,
  },
  cards: {
    gap: guideLayout.cardGap,
  },
});
