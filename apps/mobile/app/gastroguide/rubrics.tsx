import { colors, guideLayout } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GuideRubricTile } from "../../src/components/articles/GuideRubricRail";
import { GuideSectionHeader } from "../../src/components/articles/GuideSectionHeader";
import { BottomNavBar, useNavBarSpacing } from "../../src/components/BottomNavBar";
import { DataErrorState } from "../../src/components/DataErrorState";
import {
  useGuideCategories,
  useGuideCollections,
} from "../../src/components/explore/use-explore-data";
import { ArrowLeft } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { EmptyState, LoadingState } from "../../src/components/StateViews";
import { usePullToRefresh } from "../../src/hooks/usePullToRefresh";

const t = getDictionary();

/**
 * ЭКРАН «ВСЕ РУБРИКИ» — `/gastroguide/rubrics`. Открывается надписью
 * «Смотреть все» рядом с заголовком «Рубрики» на корне гастрогида
 * (node 3192:6246, надпись 3192:6261).
 *
 * ОТДЕЛЬНОГО МАКЕТА У ЭКРАНА НЕТ. Он заведён 2026-08-28 по правке владельца
 * («лучше столбиком»), поэтому взято ровно то, что уже нарисовано у соседей
 * по гастрогиду, и ни строкой больше: кремовый лист (#F7F5F1), шапка со
 * стрелкой назад — та же, что на ветках «загружаем / не найдено» экрана
 * рубрики, — заголовок секции `GuideSectionHeader` и общая нижняя плашка.
 * Журнального кадра `GuideHero` здесь нет: у списка рубрик нет ни своей
 * фотографии, ни слогана, и рисовать кадр было бы не на чем.
 *
 * ПЛИТКИ ТЕ ЖЕ, ЧТО В ЛЕНТЕ. Буквально тот же `GuideRubricTile`, который
 * рисует горизонтальная лента «Рубрики», а не похожая копия: высота 158,
 * скругление 22, затемнение снизу, название в нижнем левом углу. Разница одна
 * — плитка тянется во всю ширину листа (`fullWidth`), потому что владелец
 * выбрал столбик, а не сетку.
 *
 * ОТКУДА ДАННЫЕ:
 *
 *   • СПИСОК И НАЗВАНИЯ — `GET /gastroguide/categories`. Это ЕДИНСТВЕННЫЙ
 *     полный список рубрик: лента на корне вкладки показывает не рубрики, а
 *     ПОДБОРКИ, помеченные рубрикой, и рубрика без подборок в неё не попадает
 *     вовсе. Порядок — редакционный, тот, в котором ответил сервер;
 *   • ФОТОГРАФИЯ — обложка ПЕРВОЙ подборки, помеченной этим слагом
 *     (`GET /gastroguide/collections`). Своей картинки у рубрики в ответе
 *     нет (см. `GuideCategory`), и выдумывать её нельзя: подборок нет —
 *     плитка рисует стандартную плашку «фото нет».
 *
 * ЗОЛОТОЙ НАДПИСИ НАД НАЗВАНИЕМ ЗДЕСЬ НЕТ, хотя в ленте она есть. В ленте это
 * слаг рубрики над названием ПОДБОРКИ, то есть две разные вещи; здесь и
 * надпись, и заголовок были бы одной и той же рубрикой, написанной дважды.
 *
 * ПЛИТКА ВЕДЁТ ТУДА ЖЕ, КУДА И В ЛЕНТЕ, — на экран рубрики
 * (`/gastroguide/rubric/:slug`), и здесь слаг известен точно: он пришёл
 * вместе с рубрикой, а не выбирался из `categorySlugs` подборки.
 *
 * СОСТОЯНИЯ. Отказ ПОДБОРОК экран не рушит: без них у плиток не будет
 * фотографий, но список рубрик и есть то, ради чего сюда пришли. Показывается
 * только отказ САМИХ РУБРИК — без них показывать нечего.
 */
export default function GuideRubricsScreen() {
  const router = useRouter();
  const navPad = useNavBarSpacing();

  const categoriesQuery = useGuideCategories();
  const collectionsQuery = useGuideCollections();

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const collections = useMemo(() => collectionsQuery.data ?? [], [collectionsQuery.data]);

  /** Обложка рубрики = обложка первой её подборки. Нет подборок — `null`. */
  const coverOf = useCallback(
    (slug: string) =>
      collections.find((collection) => collection.categorySlugs.includes(slug))?.coverImageUrl ??
      null,
    [collections],
  );

  // Тянется весь экран целиком: `Promise.all` гасит кружок тогда, когда
  // ответил ПОСЛЕДНИЙ запрос, а `refetch()` у react-query не бросает.
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([categoriesQuery.refetch(), collectionsQuery.refetch()]),
  );

  const openRubric = useCallback(
    (slug: string) => router.push(`/gastroguide/rubric/${slug}`),
    [router],
  );

  // Шапка одна на все ветки: стрелка назад на кремовом листе — ровно та же,
  // что на ветках «загружаем / не найдено» экрана рубрики.
  const header = (
    <SafeAreaView edges={["top"]}>
      <View style={styles.header}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t.a11y.backButton}
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );

  return (
    <View style={styles.root}>
      {header}

      <ScrollView
        contentContainerStyle={{ paddingBottom: navPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.content}>
          <View style={styles.section}>
            <GuideSectionHeader title={t.articles.rubricsTitle} />

            {categoriesQuery.isLoading ? (
              <LoadingState title={t.articles.rubricsAllLoading} compact />
            ) : categoriesQuery.isError ? (
              <DataErrorState
                error={categoriesQuery.error}
                onRetry={() => void categoriesQuery.refetch()}
                compact
              />
            ) : categories.length === 0 ? (
              <EmptyState
                title={t.articles.rubricsAllEmptyTitle}
                description={t.articles.rubricsAllEmptyDescription}
                compact
              />
            ) : (
              <View style={styles.tiles}>
                {categories.map((category) => (
                  <GuideRubricTile
                    key={category.slug}
                    coverImageUrl={coverOf(category.slug)}
                    title={category.title}
                    accessibilityLabel={t.articles.openRubric(category.title)}
                    onPress={() => openRubric(category.slug)}
                    fullWidth
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Кремовый лист гастрогида (#F7F5F1), тот же, что на корне вкладки и на
    // экране одной рубрики.
    backgroundColor: colors.guide.sheet,
  },
  header: {
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
  // Тот же просвет, что между плитками в ленте (8): плитки те же самые, и
  // менять расстояние между ними от смены направления не за что.
  tiles: {
    gap: guideLayout.rubricGap,
  },
});
