import type { Restaurant } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { openMap } from "../../lib/external-links";
import { MapPin } from "../icons";

const t = getDictionary();

/**
 * The map block under the contacts (Figma node 488:9876).
 *
 * IT IS A PLACEHOLDER, ON PURPOSE. The design shows a rendered static map of
 * the venue's surroundings, but there is no static-map source in this project:
 * the backend has no map-preview field or endpoint (`mapImage` in
 * packages/api is `stubMapImage`, a placehold.co URL), and wiring a third-party
 * tiles provider means an API key, which must never be baked into a mobile
 * bundle. So instead of a fake map picture this renders a clearly-a-placeholder
 * block that says what it is and what tapping it does.
 *
 * The tap target is real: it opens the device's maps app at the venue's
 * `latitude`/`longitude`, which ARE real values from the detail endpoint. With
 * no coordinates the block is inert and says so rather than pretending.
 */
export function MapPreview({ restaurant }: { restaurant: Restaurant }) {
  const { latitude, longitude } = restaurant;
  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  const content = (
    <>
      <View style={styles.pin}>
        <MapPin size={20} color={colors.text.onDark} weight="fill" />
      </View>
      <Text style={styles.title}>{t.booking.mapPlaceholderTitle}</Text>
      <Text style={styles.description}>
        {hasCoordinates ? t.booking.mapPlaceholderDescription : t.booking.mapNoCoordinates}
      </Text>
    </>
  );

  if (!hasCoordinates) {
    return <View style={styles.block}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.booking.openInMaps}: ${restaurant.name}`}
      onPress={() =>
        void openMap({ latitude, longitude, label: restaurant.name.trim() || restaurant.address })
      }
      style={({ pressed }) => [styles.block, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    height: controlHeight.mapPreview,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    borderWidth: 1,
    borderColor: colors.border.control,
    // Dashed, so nobody mistakes it for a map that failed to load.
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
    textAlign: "center",
  },
  description: {
    ...typography.caption,
    color: colors.text.mutedStrong,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
