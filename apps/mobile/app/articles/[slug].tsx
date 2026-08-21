import { RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GuideVenueBlock } from "../../src/components/articles/GuideVenueBlock";
import { detailStyles } from "../../src/components/detail/DetailBlocks";
import { useGuideCollection } from "../../src/components/explore/use-explore-data";
import { ArrowLeft, Export } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { PhotoView } from "../../src/components/PhotoView";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";

const t = getDictionary();

/**
 * «Статья» — one editorial collection's detail (GET /gastroguide/collections/:slug).
 *
 * Раскладка макета 1001:11921: серый лист экрана, на нём белые блоки с
 * просветом 8 — тот же приём, что на карточке афиши и акции, поэтому фон,
 * шапка и белый «пол» берутся из общего `detailStyles`, а не пишутся заново.
 *
 * Блок 1 — обложка (240, поля по 8, радиус 24), название, подпись «От BookEat»
 * и чип «Подборка»; у блока скруглён только НИЗ, потому что сверху он
 * продолжает белую шапку. Дальше — блоки заведений (`GuideVenueBlock`).
 * Tapping a venue block opens that restaurant (`/restaurant/:restaurantId`) —
 * the same nav the catalog uses.
 *
 * The header carries «Поделиться» — the design draws a heart beside it, but
 * there is no favourite-an-article endpoint, and an inert heart is a lie about
 * what the app remembers (see the fake-favorite-heart bug in team-memory). It
 * lands the day the backend can store it.
 *
 * States: an unknown slug is a 404 → an honest "not found" (no retry, there is
 * nothing to re-fetch that would exist); any other failure → a retryable error.
 */
export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useGuideCollection(slug);
  const collection = query.data;

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

  const header = (right?: React.ReactNode) => (
    <SafeAreaView edges={["top"]} style={detailStyles.headerSafeArea}>
      <View style={detailStyles.header}>
        <IconButton icon={ArrowLeft} accessibilityLabel={t.a11y.backButton} onPress={() => router.back()} />
        {right}
      </View>
    </SafeAreaView>
  );

  if (query.isLoading) {
    return (
      <View style={detailStyles.root}>
        {header()}
        <LoadingState title={t.articles.loading} />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={detailStyles.root}>
        {header()}
        <EmptyState title={t.articles.notFoundTitle} description={t.articles.notFoundDescription} />
      </View>
    );
  }

  if (query.isError || !collection) {
    return (
      <View style={detailStyles.root}>
        {header()}
        <ErrorState
          title={t.articles.errorTitle}
          description={t.articles.errorDescription}
          action={{ label: t.common.retry, onPress: () => query.refetch(), variant: "button" }}
        />
      </View>
    );
  }

  return (
    <View style={detailStyles.root}>
      {header(
        <IconButton
          icon={Export}
          accessibilityLabel={t.a11y.shareButton}
          onPress={() => void share(collection.title)}
        />,
      )}

      <ScrollView
        style={detailStyles.scrollFloor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={detailStyles.scrollContent}
      >
        <View style={styles.summaryBlock}>
          <View style={styles.coverContainer}>
            <PhotoView
              uri={collection.coverImageUrl}
              style={styles.cover}
              transition={200}
              priority="high"
              placeholderIconSize={40}
              decorative
            />
          </View>

          <View style={styles.summary}>
            {/* Название и подпись стоят вплотную (просвет 2): это одна
                надпись из двух строк, а не два независимых пункта. */}
            <View style={styles.titleGroup}>
              <Text style={styles.title}>{collection.title}</Text>
              <Text style={styles.author}>{t.explore.articleAuthorDefault}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{t.articles.collectionChip}</Text>
            </View>
            {/* Подзаголовка и описания в макете нет: там весь текст статьи
                разложен по блокам заведений. У живых подборок он лежит именно
                в этих полях, и прятать его значило бы потерять единственную
                копию редакционного текста. */}
            {collection.subtitle ? <Text style={styles.subtitle}>{collection.subtitle}</Text> : null}
            {collection.description ? (
              <Text style={styles.description}>{collection.description}</Text>
            ) : null}
          </View>
        </View>

        {collection.venues.length > 0 ? (
          collection.venues.map((venue) => (
            <GuideVenueBlock key={venue.restaurantId} venue={venue} onPress={openRestaurant} />
          ))
        ) : (
          // Статья про места вне каталога заканчивается текстом, и без этой
          // кнопки — в никуда. Подставлять сюда «похожие заведения» я не стал:
          // связь была бы выдуманной, а человек такое чувствует.
          <View style={styles.browse}>
            <PrimaryButton
              label={t.articles.browseVenues}
              variant="secondary"
              size="lg"
              onPress={() => router.push("/search")}
            />
          </View>
        )}

        {/* Белый «пол» под последним блоком — отдельный элемент, а не нижний
            отступ контейнера: отступ красился бы серым, и под последней
            карточкой снова тянулась бы серая полоса. В макете последний блок
            уходит под индикатор «домой» (34), поэтому высота = нижняя
            безопасная зона; на устройствах без неё остаётся 16, чтобы блок не
            упирался в самый край экрана. */}
        <View style={[styles.bottomFloor, { height: Math.max(insets.bottom, spacing.lg) }]} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  browse: {
    paddingHorizontal: spacing.lg,
  },
  // Обложка, название, подпись и чип — ОДИН белый блок. Скруглён только низ:
  // сверху он продолжает белую шапку экрана без просвета.
  summaryBlock: {
    backgroundColor: colors.background.surface,
    borderBottomLeftRadius: radius.contentBlock,
    borderBottomRightRadius: radius.contentBlock,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  coverContainer: {
    paddingHorizontal: spacing.sm,
  },
  cover: {
    width: "100%",
    height: 240,
    borderRadius: radius.photoHero,
    backgroundColor: colors.background.chip,
  },
  summary: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  titleGroup: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  author: {
    ...typography.body,
    color: colors.text.primary,
  },
  // Метка той же бордовой гаммы, что чипы в списках и на карточке заведения
  // (правка владельца 2026-08-21: в статьях метка оставалась серой).
  chip: {
    alignSelf: "flex-start",
    backgroundColor: colors.background.chipBrand,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipLabel: {
    ...typography.labelMedium,
    color: colors.text.brand,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
  description: {
    ...typography.body,
    color: colors.text.primary,
  },
  bottomFloor: {
    // Съедает просвет 8, который контейнер ставит между блоками: последний
    // блок должен переходить в белый «пол» без серой полоски.
    marginTop: -spacing.sm,
    backgroundColor: colors.background.surface,
  },
});
