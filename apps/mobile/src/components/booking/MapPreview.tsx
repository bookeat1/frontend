import type { MapPreviewSize, Restaurant } from "@bookeat/api";
import {
  colors,
  controlHeight,
  hitSlop,
  radius,
  spacing,
  typography,
} from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { PixelRatio, Pressable, StyleSheet, Text, View } from "react-native";
import { openMap } from "../../lib/external-links";
import { diagnoseMapFailure, mapPreviewsEnabled } from "../../lib/map-preview";
import { useRepository } from "../../lib/repository";
import { MapPin } from "../icons";

const t = getDictionary();

/**
 * The map block under the contacts (Figma node 488:9876).
 *
 * The picture is the server-rendered preview from `GET /restaurants/:id/map`
 * (backend ADR-012): the provider key stays on the server, we only build a URL
 * and let <Image> fetch it, so the platform's HTTP cache plus the server's
 * `Cache-Control`/ETag do the caching for us.
 *
 * Three things this component refuses to do:
 *
 *  - show a broken image. An <Image> cannot read the JSON error body, so ANY
 *    load failure means "no map" and falls back to the placeholder block that
 *    was here before.
 *  - retry in a loop. A URL that failed is remembered (`brokenUrl`) and the
 *    <Image> is unmounted; it is only attempted again if the URL itself
 *    changes (another venue, another size).
 *  - keep asking on an environment that has no map provider at all — see
 *    lib/map-preview.ts for the session latch.
 *
 * Tapping opens the device's maps app at the venue's coordinates, exactly as
 * before, in every state: with a map, with the placeholder, while loading.
 * With no coordinates the block is inert and says so instead of pretending.
 */
export function MapPreview({
  restaurant,
  size = "detail",
}: {
  restaurant: Restaurant;
  /** Which server preset to ask for. All three are 16:9; `detail` (480x270)
   * fits a full-width card on a phone, `wide` (640x360) is for a wider box. */
  size?: MapPreviewSize;
}) {
  const repository = useRepository();
  const { latitude, longitude } = restaurant;
  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  // A retina render is worth the bytes on a phone screen; a 1x device would
  // only pay for pixels it cannot show.
  const scale = PixelRatio.get() >= 2 ? 2 : 1;
  const url = hasCoordinates
    ? repository.getMapPreviewUrl(restaurant.id, { size, scale })
    : undefined;

  const [brokenUrl, setBrokenUrl] = React.useState<string | null>(null);
  // Read once per mount: the latch only ever goes one way, and the component
  // that discovers it flips its own copy in onError below.
  const [environmentHasMaps, setEnvironmentHasMaps] = React.useState(mapPreviewsEnabled);

  const showImage = Boolean(url) && environmentHasMaps && brokenUrl !== url;

  const handleError = React.useCallback(() => {
    if (!url) return;
    setBrokenUrl(url);
    void diagnoseMapFailure(url).then(() => setEnvironmentHasMaps(mapPreviewsEnabled()));
  }, [url]);

  const placeholder = (
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
    return <View style={[styles.block, styles.placeholderBlock]}>{placeholder}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      // The map picture itself is decorative: the address is right above it as
      // real text, so a screen reader announces the action, not the image.
      accessibilityLabel={`${t.booking.openInMaps}: ${restaurant.name}`}
      accessibilityHint={t.booking.openInMapsHint}
      onPress={() =>
        void openMap({ latitude, longitude, label: restaurant.name.trim() || restaurant.address })
      }
      style={({ pressed }) => [
        styles.block,
        showImage ? null : styles.placeholderBlock,
        pressed && styles.pressed,
      ]}
    >
      {showImage && url ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          // The block already has its final height, so nothing jumps when the
          // bytes arrive; the fade just avoids a hard flash.
          transition={150}
          onError={handleError}
          // Decorative — never announced. The Pressable above carries the
          // label, and "картинка карты" would add nothing to it.
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          alt=""
        />
      ) : (
        placeholder
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    height: controlHeight.mapPreview,
    // Far above the 44pt floor, but stated so a future height change cannot
    // silently produce an untappable strip.
    minHeight: hitSlop.minTouchTarget,
    borderRadius: radius.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.chip,
  },
  placeholderBlock: {
    borderWidth: 1,
    borderColor: colors.border.control,
    // Dashed, so nobody mistakes it for a map that failed to load.
    borderStyle: "dashed",
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
