import type { RestaurantStory } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";
import { useRestaurantStories } from "../../hooks/useRestaurant";
import { StoryViewer } from "./StoryViewer";

const t = getDictionary();

const CARD_WIDTH = 100;
const CARD_HEIGHT = 132;
/** How many neutral tiles the loading skeleton draws — enough to fill a
 * 360-wide screen so the rail does not visibly grow when data lands. */
const SKELETON_COUNT = 4;

/**
 * The horizontal "stories" rail under the Обзор/Фото tabs — Instagram-highlight
 * cards the venue pins to its screen. Each card is a red-bordered rounded tile
 * with the image filling it and an optional caption over a bottom gradient;
 * tapping one opens the fullscreen {@link StoryViewer}.
 *
 * All four async states are handled the way the rest of the venue screen's
 * optional strips are: a skeleton while loading, and NOTHING at all when the
 * request fails OR answers an empty set — a venue with no stories has no rail,
 * same as one with no promos. The rail never blocks or errors the screen.
 */
export function StoriesRail({ restaurantId }: { restaurantId: string }) {
  const { data: stories, isLoading } = useRestaurantStories(restaurantId);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  if (isLoading) return <StoriesRailSkeleton />;
  // Ошибку и пустой массив показываем одинаково — рельса просто исчезает, как
  // и любая другая необязательная лента заведения. Экран не блокируется.
  if (!stories || stories.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {stories.map((story, index) => (
          <StoryCard key={story.id} story={story} onPress={() => setOpenIndex(index)} />
        ))}
      </ScrollView>

      <StoryViewer
        // `openIndex` != null означает «открыто на этой истории». Ключа modal
        // достаточно, чтобы не держать индекс, когда лист закрыт.
        stories={stories}
        initialIndex={openIndex ?? 0}
        visible={openIndex !== null}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}

function StoryCard({ story, onPress }: { story: RestaurantStory; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        story.caption ? t.restaurant.storyCard(story.caption) : t.restaurant.storyCardGeneric
      }
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Подпись поверх плитки несёт весь смысл, поэтому фото декоративно.
          Нет фото — плитка фирменного цвета, как в промо-баннерах. */}
      <PhotoView
        uri={story.imageUrl}
        style={styles.image}
        size="tile"
        decorative
        placeholderIcon={false}
        placeholderColor={colors.background.bannerPlaceholder}
      />
      {story.caption ? (
        <>
          <LinearGradient
            colors={[colors.overlay.bannerGradientTop, colors.overlay.bannerGradientBottom]}
            style={styles.gradient}
          />
          <Text style={styles.caption} numberOfLines={2}>
            {story.caption}
          </Text>
        </>
      ) : null}
    </Pressable>
  );
}

function StoriesRailSkeleton() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <View key={index} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: spacing.sm,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  cardPressed: {
    opacity: 0.85,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: CARD_HEIGHT * 0.6,
  },
  caption: {
    ...typography.bannerCaption,
    color: colors.text.onDark,
  },
  skeletonCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
});
