import type { GuideCollectionVenue } from "@bookeat/api";
import { colors, guideLayout } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GuideSectionHeader } from "../../../src/components/articles/GuideSectionHeader";
import { GUIDE_HERO_CONTENT_HEIGHT, GuideHero } from "../../../src/components/articles/GuideHero";
import { BottomNavBar, useNavBarSpacing } from "../../../src/components/BottomNavBar";
import { DataErrorState } from "../../../src/components/DataErrorState";
import {
  useGuideCategories,
  useGuideCity,
  useGuideCollectionDetails,
  useGuideCollections,
} from "../../../src/components/explore/use-explore-data";
import { ArrowLeft } from "../../../src/components/icons";
import { IconButton } from "../../../src/components/IconButton";
import { ListMediaCard } from "../../../src/components/ListMediaCard";
import { EmptyState, LoadingState } from "../../../src/components/StateViews";
import { usePullToRefresh } from "../../../src/hooks/usePullToRefresh";
import { venueSubtitle } from "../../../src/lib/cuisine-display";

const t = getDictionary();

/**
 * ЭКРАН ОДНОЙ РУБРИКИ ГАСТРОГИДА — макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 3492:13723 («Рубрики»). Открывается плиткой ленты «Рубрики» на
 * `/articles`.
 *
 * Сверху вниз ровно то, что нарисовано: журнальная шапка на 340 (та же
 * `GuideHero`, что у корня вкладки, — кадр, скругление 28 и оба затемнения
 * там одинаковые), кремовый лист с заголовком «Избранное редакции» и
 * ВЕРТИКАЛЬНЫЙ список карточек заведений, снизу — общая нижняя плашка.
 *
 * ДВУХ ЭЛЕМЕНТОВ МАКЕТА ЗДЕСЬ НЕТ НАМЕРЕННО, и это решение владельца
 * (2026-08-28, «не надо заводить, это просто вёрстка»):
 *
 *   • плашка «№1» в левом верхнем углу карточки — это РАНГ места в рубрике.
 *     Ни у подборки, ни у заведения в ответе `GET /gastroguide/collections/:slug`
 *     нет ни рейтинга, ни оценки, ни позиции-как-места: `position` там — это
 *     порядок вывода, заданный редактором, и подписывать его «№1» значило бы
 *     объявить первое попавшееся заведение лучшим в рубрике;
 *   • плашка «ВЫБОР VISIT ALMATY» в правом верхнем углу — редакционная
 *     отметка. Поля «выбор редакции» в ответе нет ни у заведения, ни у
 *     подборки, а нарисовать её всем сразу значит обесценить саму отметку.
 *
 * Обе вернутся сюда в тот день, когда за ними появится поле в API, — и ни
 * днём раньше. Всё остальное с макета на месте.
 *
 * КАРТОЧКА ЗАВЕДЕНИЯ — ОБЩАЯ. В макете она называется «Card / Flour Demi»
 * (node 3496:13854), то есть буквально тот же узел, что в поиске и избранном,
 * и рисует её та же `ListMediaCard` (198, скругление 22, название и подпись
 * внутри снимка). Второй, чуть иначе настроенной карточки здесь не заводится.
 * Подпись под названием собирает общий помощник `venueSubtitle` — «кухня ·
 * ступень чека», ровно как на карточке каталога. Расстояния («500 м») в ней
 * нет: геопозиции гостя в приложении нет, а в ответе подборки — расстояния.
 *
 * ОТКУДА БЕРУТСЯ ДАННЫЕ (новых ручек не заводилось, все три уже есть):
 *
 *   • НАЗВАНИЕ РУБРИКИ — `GET /gastroguide/categories`. Это единственное, что
 *     ручка рубрик умеет отдать: ни обложки, ни описания в её ответе нет.
 *     Рубрики с таким слагом в списке не оказалось — берём название ПЕРВОЙ
 *     подборки рубрики: это лучше пустой шапки и честнее выдуманного текста;
 *   • ФОТОГРАФИЯ И СТРОКА ПОД НАЗВАНИЕМ — у первой подборки, помеченной этим
 *     слагом (`cover_image_url` и `description` из
 *     `GET /gastroguide/collections`). Обложки нет — стандартная плашка
 *     «фото нет», выдуманной картинки тут не будет; описания нет — строки
 *     просто нет;
 *   • СПИСОК ЗАВЕДЕНИЙ — заведения ВСЕХ подборок рубрики
 *     (`GET /gastroguide/collections/:slug` на каждую), подряд, в
 *     редакционном порядке. На проде 2026-08-28 подборка в рубрике одна, но
 *     зашивать это в экран нельзя, поэтому запросов столько, сколько
 *     подборок, а совпавшие заведения СХЛОПЫВАЮТСЯ по `restaurantId`: одно
 *     место в двух подборках одной рубрики — это одно место в списке, а не
 *     две карточки подряд.
 *
 * СОСТОЯНИЯ. Пока не известны ни название, ни обложка, шапку рисовать не на
 * чем — на этих ветках остаётся стрелка на кремовом листе (тот же приём, что
 * на странице подборки). Как только название нашлось, шапка стоит всегда, а
 * загрузка/отказ/пустота живут внутри листа: гость видит, КУДА он попал, даже
 * если заведения ещё едут. Неизвестный слаг — честное «рубрика не найдена», а
 * не ошибка сети: повтор тут ничего не изменит.
 */
export default function GuideRubricScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const navPad = useNavBarSpacing();
  const { city } = useGuideCity();
  const [heroBehindStatusBar, setHeroBehindStatusBar] = useState(true);

  const categoriesQuery = useGuideCategories();
  const collectionsQuery = useGuideCollections();

  // Подборки этой рубрики — в том порядке, в котором их отдал сервер.
  const rubricCollections = useMemo(
    () => (collectionsQuery.data ?? []).filter((c) => slug && c.categorySlugs.includes(slug)),
    [collectionsQuery.data, slug],
  );

  const detailQueries = useGuideCollectionDetails(
    useMemo(() => rubricCollections.map((c) => c.slug), [rubricCollections]),
  );

  const category = useMemo(
    () => (categoriesQuery.data ?? []).find((c) => c.slug === slug),
    [categoriesQuery.data, slug],
  );

  const lead = rubricCollections[0];
  // Название: рубрика, а если её нет в справочнике — первая подборка рубрики.
  const title = category?.title || lead?.title || "";

  // БЕЗ useMemo намеренно: `useQueries` отдаёт новый массив на каждый рендер,
  // и мемоизация по нему ничего бы не сохранила — только соврала бы о том, что
  // список стабилен. Склейка двух коротких списков дешевле самого сравнения.
  const venues = dedupeVenues(detailQueries.map((q) => q.data));

  const openRestaurant = useCallback(
    (restaurantId: string) => router.push(`/restaurant/${restaurantId}`),
    [router],
  );

  // Тянется весь экран целиком. `Promise.all` гасит кружок тогда, когда
  // ответил ПОСЛЕДНИЙ запрос, а не первый; `refetch()` у react-query не
  // бросает, поэтому отказ одной подборки не рушит жест.
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      categoriesQuery.refetch(),
      collectionsQuery.refetch(),
      ...detailQueries.map((q) => q.refetch()),
    ]),
  );

  // Шапка веток «загружаем / не найдено»: рисовать журнальный кадр не на чем
  // (ни названия, ни обложки ещё нет), а пустой чёрный кадр читался бы как
  // поломка. Остаётся стрелка на кремовом листе.
  const plainHeader = () => (
    <SafeAreaView edges={["top"]}>
      <View style={styles.plainHeader}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t.a11y.backButton}
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );

  if (collectionsQuery.isLoading || categoriesQuery.isLoading) {
    return (
      <View style={styles.root}>
        {plainHeader()}
        <LoadingState title={t.articles.rubricLoading} />
      </View>
    );
  }

  if (collectionsQuery.isError) {
    return (
      <View style={styles.root}>
        {plainHeader()}
        <DataErrorState
          error={collectionsQuery.error}
          onRetry={() => void collectionsQuery.refetch()}
        />
      </View>
    );
  }

  // Ни рубрики с таким слагом, ни подборок с ним: ссылка устарела.
  if (!title) {
    return (
      <View style={styles.root}>
        {plainHeader()}
        <EmptyState
          title={t.articles.rubricNotFoundTitle}
          description={t.articles.rubricNotFoundDescription}
        />
      </View>
    );
  }

  const detailsLoading = detailQueries.some((q) => q.isLoading);
  // Отказ показываем, только когда не осталось НИ ОДНОЙ пришедшей подборки:
  // если одна из двух ответила, честнее показать её заведения, чем спрятать
  // рубрику целиком за ошибкой.
  const failed = detailQueries.find((q) => q.isError);
  const allFailed = detailQueries.length > 0 && detailQueries.every((q) => q.isError);

  return (
    <View style={styles.root}>
      {/* Часы и заряд белые, пока под ними фотография шапки, и тёмные, когда
          она уехала вверх — тот же приём, что на корне гастрогида. */}
      <StatusBar style={heroBehindStatusBar ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: navPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const passed = event.nativeEvent.contentOffset.y > GUIDE_HERO_CONTENT_HEIGHT;
          if (passed === heroBehindStatusBar) setHeroBehindStatusBar(!passed);
        }}
      >
        <GuideHero
          title={t.articles.rubricHeaderTitle}
          eyebrow={t.articles.rubricEyebrow(city)}
          headline={title}
          subline={lead?.description ?? ""}
          // Экран НЕ корень вкладки: стрелка есть и работает.
          onBack={() => router.back()}
          cover={{ uri: lead?.coverImageUrl ?? null }}
          eyebrowGap={guideLayout.rubricHeroEyebrowGap}
          sublineGap={guideLayout.rubricHeroSublineGap}
        />

        <View style={styles.content}>
          <View style={styles.section}>
            <GuideSectionHeader title={t.articles.rubricEditorialTitle} />

            {detailsLoading ? (
              <LoadingState title={t.articles.rubricLoading} compact />
            ) : allFailed && failed ? (
              <DataErrorState
                error={failed.error}
                onRetry={() => detailQueries.forEach((q) => void q.refetch())}
                compact
              />
            ) : venues.length === 0 ? (
              <EmptyState
                title={t.articles.rubricEmptyTitle}
                description={t.articles.rubricEmptyDescription}
                compact
              />
            ) : (
              <View style={styles.venues}>
                {venues.map((venue) => (
                  <ListMediaCard
                    key={venue.restaurantId}
                    title={venue.name}
                    titleLines={1}
                    subtitle={venueSubtitle(venue.cuisineType, venue.priceCategory)}
                    coverUri={venue.imageUrl}
                    onPress={() => openRestaurant(venue.restaurantId)}
                    accessibilityLabel={t.articles.openVenue(venue.name)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <BottomNavBar />
    </View>
  );
}

/**
 * Заведения всех подборок рубрики подряд, БЕЗ повторов.
 *
 * Схлопываем по `restaurantId`, а не по названию: два разных «Del Papa» в
 * разных ТЦ — это два заведения, а одно и то же место в двух подборках одной
 * рубрики — одна карточка. Побеждает ПЕРВОЕ вхождение: у него редакционный
 * порядок старшей подборки.
 */
export function dedupeVenues(
  details: readonly ({ venues: GuideCollectionVenue[] } | undefined)[],
): GuideCollectionVenue[] {
  const seen = new Set<string>();
  const venues: GuideCollectionVenue[] = [];
  for (const detail of details) {
    for (const venue of detail?.venues ?? []) {
      if (seen.has(venue.restaurantId)) continue;
      seen.add(venue.restaurantId);
      venues.push(venue);
    }
  }
  return venues;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Кремовый лист гастрогида (#F7F5F1), тот же, что на корне вкладки.
    backgroundColor: colors.guide.sheet,
  },
  plainHeader: {
    paddingHorizontal: guideLayout.contentPaddingHorizontal,
    paddingTop: guideLayout.contentPaddingTop,
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
  venues: {
    gap: guideLayout.venueListGap,
  },
});
