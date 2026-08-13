import { RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GuideVenueBlock } from "../../src/components/articles/GuideVenueBlock";
import { useGuideCollection } from "../../src/components/explore/use-explore-data";
import { ArrowLeft, Export } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { PhotoView } from "../../src/components/PhotoView";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";

const t = getDictionary();

/**
 * «Статья» — one editorial collection's detail (GET /gastroguide/collections/:slug).
 *
 * Hero cover, title, a «Подборка» chip, the collection description, then the
 * ordered venue blocks. Tapping a venue block opens that restaurant
 * (`/restaurant/:restaurantId`) — the same nav the catalog uses.
 *
 * The header carries «Поделиться» — the design draws a heart beside it, but
 * there is no favourite-an-article endpoint, and an inert heart is a lie about
 * what the app remembers (see the fake-favorite-heart bug in team-memory). It
 * lands the day the backend can store it.
 *
 * Order under the cover follows the design (node 1001:11921): title, then the
 * byline («От BookEat» — a constant, the payload has no author), then the
 * «Подборка» chip.
 *
 * States: an unknown slug is a 404 → an honest "not found" (no retry, there is
 * nothing to re-fetch that would exist); any other failure → a retryable error.
 */
export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
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
    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
      <View style={styles.header}>
        <IconButton icon={ArrowLeft} accessibilityLabel={t.a11y.backButton} onPress={() => router.back()} />
        {right}
      </View>
    </SafeAreaView>
  );

  if (query.isLoading) {
    return (
      <View style={styles.root}>
        {header()}
        <LoadingState title={t.articles.loading} />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={styles.root}>
        {header()}
        <EmptyState title={t.articles.notFoundTitle} description={t.articles.notFoundDescription} />
      </View>
    );
  }

  if (query.isError || !collection) {
    return (
      <View style={styles.root}>
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
    <View style={styles.root}>
      {header(
        <IconButton
          icon={Export}
          accessibilityLabel={t.a11y.shareButton}
          onPress={() => void share(collection.title)}
        />,
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
          <Text style={styles.title}>{collection.title}</Text>
          <Text style={styles.author}>{t.explore.articleAuthorDefault}</Text>
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>{t.articles.collectionChip}</Text>
          </View>
          {collection.subtitle ? <Text style={styles.subtitle}>{collection.subtitle}</Text> : null}
          {collection.description ? <Text style={styles.description}>{collection.description}</Text> : null}
        </View>

        {collection.venues.length > 0 ? (
          <View style={styles.venues}>
            {collection.venues.map((venue) => (
              <GuideVenueBlock key={venue.restaurantId} venue={venue} onPress={openRestaurant} />
            ))}
          </View>
        ) : null}
      </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  coverContainer: {
    padding: spacing.sm,
    backgroundColor: colors.background.surface,
  },
  cover: {
    width: "100%",
    height: 240,
    borderRadius: radius.photoHero,
    backgroundColor: colors.background.chip,
  },
  summary: {
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: colors.background.chip,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipLabel: {
    ...typography.captionMedium,
    color: colors.text.mutedStrong,
  },
  author: {
    ...typography.body,
    color: colors.text.muted,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
  description: {
    ...typography.body,
    color: colors.text.primary,
  },
  venues: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
