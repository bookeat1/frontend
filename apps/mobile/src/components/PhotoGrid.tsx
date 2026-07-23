import type { Photo } from "@bookeat/api";
import { colors, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

const t = getDictionary();

interface PhotoGridProps {
  photos: Photo[];
  onPressPhoto: (index: number) => void;
  columns?: number;
}

/**
 * Grid used both as the "Фотографии" full gallery screen and as a preview
 * block on the restaurant card. Column count adapts to width so it still
 * looks intentional at 360px.
 */
export function PhotoGrid({ photos, onPressPhoto, columns = 2 }: PhotoGridProps) {
  const { width } = useWindowDimensions();
  const gap = spacing.sm;
  const horizontalPadding = spacing.lg * 2;
  const itemSize = (width - horizontalPadding - gap * (columns - 1)) / columns;

  return (
    <View style={styles.grid}>
      {photos.map((photo, index) => (
        <Pressable
          key={photo.id}
          onPress={() => onPressPhoto(index)}
          accessibilityRole="button"
          accessibilityLabel={t.a11y.galleryImage(index + 1)}
          style={{ width: itemSize, height: itemSize }}
        >
          <Image
            source={{ uri: photo.uri }}
            style={styles.image}
            contentFit="cover"
            accessibilityLabel={photo.alt}
            transition={150}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  image: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
});
