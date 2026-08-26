import { RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GuideRouteStopBlock } from "../../src/components/articles/GuideRouteStopBlock";
import { detailStyles } from "../../src/components/detail/DetailBlocks";
import { useGuideRoute } from "../../src/components/explore/use-explore-data";
import { ArrowLeft, Export } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { PhotoView } from "../../src/components/PhotoView";
import { usePullToRefresh } from "../../src/hooks/usePullToRefresh";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";

const t = getDictionary();

/**
 * «Гастропрогулка» — один маршрут с остановками
 * (GET /gastroguide/routes/:slug).
 *
 * Раскладка повторяет экран статьи: серый лист, белые блоки с просветом 8,
 * общий `detailStyles`. Сверху обложка, название и строка длительности, ниже
 * по блоку на остановку.
 *
 * Длительность («1 день · 4 точки») стоит на месте чипа «Подборка» с экрана
 * статьи и играет ту же роль метки. Строку пишет редакция; когда её нет,
 * подставляется счёт остановок — это единственное, что клиент вправе
 * посчитать сам.
 *
 * Состояния как у статьи: 404 (черновик, снят с публикации, старая ссылка) —
 * честное «не найдено» без кнопки повтора, всё остальное — ошибка с повтором.
 * Маршрут без остановок бэкенд опубликовать не даёт, поэтому отдельного
 * пустого состояния под список тут нет.
 */
export default function GuideRouteScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useGuideRoute(slug);
  const route = query.data;

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
      // Гость закрыл шторку или система отказала — не ошибка.
    }
  };

  const header = (right?: React.ReactNode) => (
    <SafeAreaView edges={["top"]} style={detailStyles.headerSafeArea}>
      <View style={detailStyles.header}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t.a11y.backButton}
          onPress={() => router.back()}
        />
        {right}
      </View>
    </SafeAreaView>
  );

  if (query.isLoading) {
    return (
      <View style={detailStyles.root}>
        {header()}
        <LoadingState title={t.articles.routeLoading} />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={detailStyles.root}>
        {header()}
        <EmptyState
          title={t.articles.routeNotFoundTitle}
          description={t.articles.routeNotFoundDescription}
        />
      </View>
    );
  }

  if (query.isError || !route) {
    return (
      <View style={detailStyles.root}>
        {header()}
        <ErrorState
          title={t.articles.routeErrorTitle}
          description={t.articles.errorDescription}
          action={{ label: t.common.retry, onPress: () => query.refetch(), variant: "button" }}
        />
      </View>
    );
  }

  const duration = route.durationLabel || t.articles.routePoints(route.pointCount);

  return (
    <View style={detailStyles.root}>
      {header(
        <IconButton
          icon={Export}
          accessibilityLabel={t.a11y.shareButton}
          onPress={() => void share(route.title)}
        />,
      )}

      <ScrollView
        style={detailStyles.scrollFloor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={detailStyles.scrollContent}
        // Ветки «загружаем», «не найдено» и «ошибка» жестом не обновляются:
        // у ошибки своя кнопка «Повторить», а 404 по слагу перезапросом не
        // лечится — там нечего появиться.
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.summaryBlock}>
          <View style={styles.coverContainer}>
            <PhotoView
              uri={route.coverImageUrl}
              style={styles.cover}
              transition={200}
              priority="high"
              placeholderIconSize={40}
              decorative
            />
          </View>

          <View style={styles.summary}>
            <Text style={styles.title}>{route.title}</Text>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{duration}</Text>
            </View>
            {route.description ? (
              <Text style={styles.description}>{route.description}</Text>
            ) : null}
          </View>
        </View>

        {route.points.map((point) => (
          <GuideRouteStopBlock key={point.id} point={point} onPress={openRestaurant} />
        ))}

        {/* Белый «пол» под последним блоком — отдельный элемент, а не нижний
            отступ контейнера: отступ красился бы серым и под последней
            остановкой тянулась бы серая полоса. */}
        <View style={[styles.bottomFloor, { height: Math.max(insets.bottom, spacing.lg) }]} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  title: {
    ...typography.titleLg,
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
  description: {
    ...typography.body,
    color: colors.text.primary,
  },
  bottomFloor: {
    marginTop: -spacing.sm,
    backgroundColor: colors.background.surface,
  },
});
