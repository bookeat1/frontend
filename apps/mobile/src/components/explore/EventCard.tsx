import {
  colors,
  controlHeight,
  exploreLayout,
  radius,
  spacing,
  typography,
} from "@bookeat/design-tokens";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FavoriteButton } from "./FavoriteButton";
import type { EventCardData } from "./placeholder";

/**
 * Event card: photo, heart, title, one date line, then grey tag chips.
 *
 * DATA IS PLACEHOLDER — events exist in the backend but only per venue and
 * only for staff; there is no guest-facing cross-venue listing, see
 * ./placeholder.ts.
 *
 * Tags render in a single row that clips at the card edge, exactly as the
 * reference does. They are labels, not filters — so they are plain Text, not
 * `FilterChip`, and carry no touch target.
 */
export function EventCard({
  event,
  onOpenRestaurant,
}: {
  event: EventCardData;
  onOpenRestaurant: (restaurantId: string) => void;
}) {
  const body = (
    <>
      <View>
        <Image
          source={{ uri: event.imageUrl }}
          style={styles.photo}
          contentFit="cover"
          transition={150}
          accessibilityLabel={event.title}
        />
        <FavoriteButton itemName={event.title} />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {event.title}
        </Text>
        <Text style={styles.when} numberOfLines={1} ellipsizeMode="tail">
          {event.whenLabel}
        </Text>
      </View>

      <View style={styles.tags}>
        {event.tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagLabel} numberOfLines={1}>
              {tag}
            </Text>
          </View>
        ))}
      </View>
    </>
  );

  if (!event.restaurantId) {
    return <View style={styles.card}>{body}</View>;
  }

  const restaurantId = event.restaurantId;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${event.whenLabel}`}
      onPress={() => onOpenRestaurant(restaurantId)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: exploreLayout.cardWidth,
    gap: spacing.sm,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.8,
  },
  photo: {
    width: exploreLayout.cardWidth,
    height: exploreLayout.cardPhotoHeight,
    borderRadius: radius.media,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  text: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  when: {
    ...typography.body,
    color: colors.text.primary,
  },
  tags: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tag: {
    height: controlHeight.compactPill,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.background.screen,
  },
  tagLabel: {
    ...typography.body,
    color: colors.text.muted,
  },
});
