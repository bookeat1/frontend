import { colors, guideLayout, listCard } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GuideSectionHeader } from "../../src/components/articles/GuideSectionHeader";
import { BottomNavBar, useNavBarSpacing } from "../../src/components/BottomNavBar";
import { DataErrorState } from "../../src/components/DataErrorState";
import {
  useGuideCategories,
  useGuideCollections,
} from "../../src/components/explore/use-explore-data";
import { ArrowLeft } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { ListMediaCard } from "../../src/components/ListMediaCard";
import { EmptyState, LoadingState } from "../../src/components/StateViews";
import { usePullToRefresh } from "../../src/hooks/usePullToRefresh";

const t = getDictionary();

/**
 * ЭКРАН «ВСЕ РУБРИКИ» — `/gastroguide/rubrics`. Открывается надписью
 * «Смотреть все» рядом с заголовком «Рубрики» на корне гастрогида
 * (node 3192:6246, надпись 3192:6261).
 *
 * ОТДЕЛЬНОГО МАКЕТА У ЭКРАНА НЕТ. Он заведён 2026-08-28 по правке владельца
 * («лучше столбиком»), а на следующем просмотре владелец попросил «сделать
 * рубрики как листинг акций»: не невысокие плитки ленты, а КРУПНЫЕ КАРТОЧКИ
 * во всю ширину — ровно те же, что на `/promotions`.
 *
 * КАРТОЧКА — ОБЩАЯ `ListMediaCard` (Figma 3z0f6dgev4HMwBAHPjTjPo, node
 * 3452:13344), тот же файл, которым рисуют себя акции, поиск, избранное и
 * афиша: снимок 198 со скруглением 22, трёхточечный градиент, название и
 * подпись ВНУТРИ снимка с полями 18. Не копия вёрстки: разойтись двум копиям
 * куда проще, чем одному компоненту, а владелец просил, чтобы два экрана
 * выглядели ОДИНАКОВО.
 *
 * ЧЕГО У РУБРИКИ НЕТ ПО СРАВНЕНИЮ С АКЦИЕЙ. Красной плашки «−N%»: скидки у
 * рубрики не бывает, и проп `badge` сюда не передаётся вовсе.
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
 *     карточка рисует стандартную плашку «фото нет»;
 *   • ПОДПИСЬ ПОД НАЗВАНИЕМ — сколько подборок помечено этой рубрикой. У
 *     акции там «заведение · срок», но у рубрики нет ни заведения, ни срока:
 *     в `GuideCategory` лежат только слаг, название и порядок. Число подборок
 *     — единственное, что про рубрику известно честно, и это ровно то, что
 *     гость за ней и найдёт. Подборок ноль (или лента подборок вовсе не
 *     ответила) — подписи просто нет: «0 подборок» ничего не сообщает, а
 *     придумывать текст не из чего.
 *
 * ЗОЛОТОЙ НАДПИСИ НАД НАЗВАНИЕМ ЗДЕСЬ НЕТ, хотя в ленте она есть. В ленте это
 * слаг рубрики над названием ПОДБОРКИ, то есть две разные вещи; здесь и
 * надпись, и заголовок были бы одной и той же рубрикой, написанной дважды.
 * У `ListMediaCard` такого слота и нет.
 *
 * КАРТОЧКА ВЕДЁТ ТУДА ЖЕ, КУДА ПЛИТКА ЛЕНТЫ, — на экран рубрики
 * (`/gastroguide/rubric/:slug`), и здесь слаг известен точно: он пришёл
 * вместе с рубрикой, а не выбирался из `categorySlugs` подборки.
 *
 * ЛЕНТУ РУБРИК НА КОРНЕ ВКЛАДКИ ЭТА ПРАВКА НЕ ТРОГАЕТ: там остаются те же
 * плитки `GuideRubricTile` (сетка гастрогида).
 *
 * СОСТОЯНИЯ. Отказ ПОДБОРОК экран не рушит: без них у карточек не будет ни
 * фотографий, ни подписи, но список рубрик и есть то, ради чего сюда пришли.
 * Показывается только отказ САМИХ РУБРИК — без них показывать нечего.
 */
export default function GuideRubricsScreen() {
  const router = useRouter();
  const navPad = useNavBarSpacing();

  const categoriesQuery = useGuideCategories();
  const collectionsQuery = useGuideCollections();

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const collections = useMemo(() => collectionsQuery.data ?? [], [collectionsQuery.data]);

  /**
   * Обложка и счётчик считаются ОДНИМ проходом по подборкам и складываются в
   * словарь по слагу: иначе на каждую рубрику приходился бы свой `find` плюс
   * свой `filter`, то есть список подборок перебирался бы дважды за карточку.
   */
  const bySlug = useMemo(() => {
    const map = new Map<string, { cover: string | null; count: number }>();
    for (const collection of collections) {
      for (const slug of collection.categorySlugs) {
        const entry = map.get(slug);
        if (entry) {
          // Обложка НЕ переписывается: она у первой подборки рубрики, как и
          // было в плиточной версии экрана.
          entry.count += 1;
        } else {
          map.set(slug, { cover: collection.coverImageUrl, count: 1 });
        }
      }
    }
    return map;
  }, [collections]);

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
              <View style={styles.cards}>
                {categories.map((category) => {
                  const entry = bySlug.get(category.slug);
                  return (
                    <ListMediaCard
                      key={category.slug}
                      title={category.title}
                      subtitle={
                        entry ? t.articles.rubricCollectionCount(entry.count) : undefined
                      }
                      coverUri={entry?.cover ?? null}
                      accessibilityLabel={t.articles.openRubric(category.title)}
                      onPress={() => openRubric(category.slug)}
                    />
                  );
                })}
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
  // Просвет между карточками — 16, тот же, что в листинге акций
  // (`listCard.gap`): карточка та же, и расстояние между ними обязано
  // совпадать, иначе «одинаково» ломается на первом же скролле. Боковые поля
  // здесь свои, гастрогидовские (16 у листа контента) — численно те же, что
  // `listCard.listPadding` у акций.
  cards: {
    gap: listCard.gap,
  },
});
