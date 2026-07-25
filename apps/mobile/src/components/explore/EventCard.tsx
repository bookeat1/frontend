import type { EventSummary } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatRelativeDateTime } from "../../lib/format";
import { InertFavoriteHeart } from "./FavoriteButton";

const t = getDictionary();

/**
 * Event card: photo, heart, title, one date line.
 *
 * REAL DATA — GET /events (RestaurantRepository.listUpcomingEvents).
 *
 * NO TAG CHIPS. The design reference draws grey chips under the date
 * ("Brunch", "Special Event"), but an event has no tags or categories
 * ANYWHERE in the backend: no column on `events`, no join table, nothing on
 * domain.Event (checked in backend-core, not assumed). Nothing else on the
 * payload stands in for them either — `venue` is a room name and `ticketed`
 * is a payment flag, not a genre. So the row is removed rather than filled
 * with a fabricated or derived label: the card ends deliberately after the
 * date instead of carrying an empty strip of grey. Bring it back when (and
 * only when) the backend grows real tags.
 *
 * The heart is still INERT: `/favorites` is restaurant-scoped end to end
 * (GET /favorites, PUT|DELETE /favorites/:restaurantId, domain.Favorite),
 * there is no favourite-an-event endpoint to call.
 */
export function EventCard({
  event,
  onOpenRestaurant,
}: {
  event: EventSummary;
  onOpenRestaurant: (restaurantId: string) => void;
}) {
  // The same helper the booking screens use — "Сегодня, 19:00" / "28 июля, 19:00".
  const whenLabel = formatRelativeDateTime(event.startsAt);

  const body = (
    <>
      <View>
        {event.coverImageUrl ? (
          <Image
            source={{ uri: event.coverImageUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
            accessibilityLabel={event.title}
          />
        ) : (
          // The backend omits `cover_image_url` for venues that uploaded none
          // and substitutes nothing. A flat tile in the photo's own
          // placeholder colour keeps the card's geometry without pretending
          // there is an image that failed to load.
          <View style={styles.photo} />
        )}
        <InertFavoriteHeart />
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {event.title}
        </Text>
        {whenLabel ? (
          <Text style={styles.when} numberOfLines={1} ellipsizeMode="tail">
            {whenLabel}
          </Text>
        ) : null}
      </View>
    </>
  );

  // Every row of the public listing carries its host venue, but the mapper is
  // defensive about it — without an id there is nowhere to navigate, so the
  // card stays a plain, non-interactive block instead of a button that does
  // nothing.
  const restaurantId = event.restaurant.id || event.restaurantId;
  if (!restaurantId) {
    return <View style={styles.card}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.eventCard(event.title, whenLabel, event.restaurant.name)}
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
});
