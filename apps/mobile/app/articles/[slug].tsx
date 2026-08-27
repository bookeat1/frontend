import { RepositoryError } from "@bookeat/api";
import { brandPageLayout, colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandCta } from "../../src/components/articles/BrandCta";
import { BrandHero } from "../../src/components/articles/BrandHero";
import { GuideVenueBlock } from "../../src/components/articles/GuideVenueBlock";
import { useGuideCollection } from "../../src/components/explore/use-explore-data";
import { ArrowLeft } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { usePullToRefresh } from "../../src/hooks/usePullToRefresh";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";

const t = getDictionary();

/**
 * Страница одной подборки гастрогида — `GET /gastroguide/collections/:slug`.
 * Макет 3z0f6dgev4HMwBAHPjTjPo, node 3424:3927 («Ocean Basket / Mobile / 390»).
 *
 * ЭКРАН ПЕРЕСОБРАН ПО НОВОМУ МАКЕТУ (2026-08-27). Было: серый лист экрана и
 * белые блоки с просветом 8, как у афиши и акции. Стало: тёплый кремовый лист
 * (#FCF7EC), тёмно-синяя шапка с круглыми кнопками поверх неё, секция «Все
 * точки» со счётчиком заведений и замыкающий синий блок с кнопкой.
 * Типографика тоже своя — Cormorant Garamond у заголовков и Montserrat у
 * текста, как нарисовано.
 *
 * ЧЕГО ИЗ МАКЕТА ЗДЕСЬ НЕТ И ПОЧЕМУ — ЧЕСТНЫЙ СПИСОК. Макет нарисован для
 * ОДНОГО бренда (Ocean Basket), а экран открывается для ЛЮБОЙ подборки, и
 * ответ ручки несёт ровно `{slug, title, subtitle, description,
 * coverImageUrl, venueCount, categorySlugs, venues[]}`. Поэтому не сделано:
 *
 *   • фирменная графика шапки — рыбы, якорь, компас, надпись «Seafood
 *     Expedition» шрифтом Lobster (узлы 3425:3927, 3425:3940, 3425:3941):
 *     рисунок конкретного бренда, поля под него в API нет;
 *   • блок «Найдите свой улов» с картой точек (node 3426:9633): ни картинки
 *     карты, ни координат заведений подборка не отдаёт;
 *   • плашка «WELCOME DRINK · Подробнее» (node 3425:3942) и значки
 *     «Welcome drink» на карточках точек (node 3441:12296): акций у подборки
 *     в ответе нет — они живут у заведения и у промо, не здесь;
 *   • секция «Фирменный улов» с блюдами и ценами (node 3441:12383): меню
 *     принадлежит заведению, а не подборке;
 *   • «ИСТОРИЯ БРЕНДА» — четыре раскрывающиеся главы (узлы 3443:12468 и
 *     соседние): у подборки ровно одно текстовое поле `description`, глав в
 *     нём нет и разрезать его на главы на клиенте нельзя;
 *   • блок Instagram «@oceanbasketkz» (node 3443:12573): у ПОДБОРКИ нет
 *     инстаграма, он есть у заведения — и стоит на карточке заведения ниже;
 *   • номера точек «01», «02» на карточках (node 3441:12295): подборка — это
 *     НАБОР заведений, а не маршрут; нумерация обещала бы порядок обхода,
 *     которого в данных нет (порядок обхода есть у гастропрогулки,
 *     `/routes/:slug`).
 *
 * ГДЕ КОД НАМЕРЕННО РАСХОДИТСЯ С МАКЕТОМ.
 *
 *   • «Все точки» в макете — ГОРИЗОНТАЛЬНАЯ лента карточек 292 pt (node
 *     3427:12241), на карточке только город и название. У живой подборки в
 *     блоке заведения лежит ещё редакционная заметка, галерея события или
 *     акции и строка «адрес · @инстаграм» — в 292 pt им места нет, и лента
 *     означала бы выбросить редакционный текст, ради которого подборку и
 *     собирают. Поэтому карточки идут вертикальным списком во всю ширину, но
 *     сами карточки — из макета: белые, скругление 16, кадр 215, город
 *     золотом заглавными над названием;
 *   • сердечка в шапке (node 3427:12227) нет: избранного для подборок на
 *     бэкенде не существует;
 *   • кнопка замыкающего блока в макете зовёт «Выберите точку на карте» —
 *     карты нет, поэтому она ведёт в каталог заведений.
 *
 * Состояния прежние: неизвестный слаг — это 404 и честное «не найдено» (нечему
 * появиться при повторе), любой другой отказ — ошибка с повтором.
 */
export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useGuideCollection(slug);
  const collection = query.data;

  const { refreshing, onRefresh } = usePullToRefresh(() => query.refetch());

  const openRestaurant = useCallback(
    (restaurantId: string) => router.push(`/restaurant/${restaurantId}`),
    [router],
  );

  const notFound =
    query.isError && query.error instanceof RepositoryError && query.error.isNotFound;

  const share = async (title: string) => {
    try {
      await Share.share({ message: `${title} — ${t.explore.articleAuthorDefault}` });
    } catch {
      // Гость закрыл шторку или система отказала — не ошибка, о которой стоит
      // сообщать.
    }
  };

  // Шапка веток «загружаем / не найдено / ошибка»: фирменной синей шапки там
  // нет — рисовать её не на чем (ни названия, ни обложки ещё нет), а пустой
  // синий кадр читался бы как поломка. Остаётся стрелка на кремовом листе.
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

  if (query.isLoading) {
    return (
      <View style={styles.root}>
        {plainHeader()}
        <LoadingState title={t.articles.loading} />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={styles.root}>
        {plainHeader()}
        <EmptyState title={t.articles.notFoundTitle} description={t.articles.notFoundDescription} />
      </View>
    );
  }

  if (query.isError || !collection) {
    return (
      <View style={styles.root}>
        {plainHeader()}
        <ErrorState
          title={t.articles.errorTitle}
          description={t.articles.errorDescription}
          action={{ label: t.common.retry, onPress: () => query.refetch(), variant: "button" }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}
        // Ветки «загружаем», «не найдено» и «ошибка» жестом не обновляются:
        // у ошибки своя кнопка «Повторить», а 404 по слагу перезапросом не
        // лечится — там нечего появиться.
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <BrandHero
          title={collection.title}
          subtitle={collection.subtitle}
          coverImageUrl={collection.coverImageUrl}
          onBack={() => router.back()}
          onShare={() => void share(collection.title)}
        />

        <View style={styles.content}>
          {/* Редакционный текст подборки. В макете на его месте четыре
              раскрывающиеся главы истории бренда; глав в данных нет, а
              выбросить единственное текстовое поле подборки нельзя — это и
              есть материал, ради которого её открыли. */}
          {collection.description ? (
            <Text style={styles.description}>{collection.description}</Text>
          ) : null}

          {collection.venues.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t.articles.allPointsTitle}</Text>
                {/* Счётчик справа — из макета (node 3427:12240). Считается по
                    ФАКТИЧЕСКИ пришедшим блокам, а не по `venueCount`: у
                    списочной формы это число могло устареть, а гость видит
                    именно карточки. */}
                <Text style={styles.sectionCount}>
                  {t.articles.venueCount(collection.venues.length)}
                </Text>
              </View>
              <View style={styles.venues}>
                {collection.venues.map((venue) => (
                  <GuideVenueBlock
                    key={venue.restaurantId}
                    venue={venue}
                    onPress={openRestaurant}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Замыкающий блок стоит ВСЕГДА, а не только у подборки без
              заведений (раньше здесь была одинокая кнопка «Посмотреть
              заведения»): в макете материал заканчивается призывом, и
              статья про места вне каталога иначе обрывается в никуда. */}
          <BrandCta
            eyebrow={t.articles.ctaEyebrow}
            title={t.articles.ctaTitle}
            actionLabel={t.articles.browseVenues}
            onPress={() => router.push("/search")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Тёплый кремовый лист страницы (#FCF7EC, node 3424:3927) вместо прежнего
    // серого: белых блоков-разделителей на этом экране больше нет.
    backgroundColor: colors.brand2.sheet,
  },
  plainHeader: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: spacing.sm,
  },
  content: {
    paddingHorizontal: brandPageLayout.contentPaddingHorizontal,
    paddingVertical: brandPageLayout.contentPaddingVertical,
    gap: brandPageLayout.sectionGap,
  },
  description: {
    ...typography.brandBody,
    color: colors.brand2.navy,
  },
  section: {
    gap: brandPageLayout.venueCardGap,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xl,
  },
  sectionTitle: {
    ...typography.brandSectionTitle,
    color: colors.brand2.navy,
    flexShrink: 1,
  },
  sectionCount: {
    ...typography.brandBody,
    color: colors.brand2.navy,
    textAlign: "right",
  },
  venues: {
    gap: brandPageLayout.venueCardGap,
  },
});
