import type { Photo } from "@bookeat/api";
import { colors } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { PhotoView } from "./PhotoView";

const t = getDictionary();

interface PhotoGridProps {
  photos: Photo[];
  onPressPhoto: (index: number) => void;
}

/**
 * Full "Фотографии" gallery grid — matches Figma node 340:2354: a masonry-ish
 * pattern of one full-width photo followed by a row of two half-width
 * photos, repeating. Falls back gracefully for any photo count.
 */
export function PhotoGrid({ photos, onPressPhoto }: PhotoGridProps) {
  const { width } = useWindowDimensions();
  const gap = 2;
  const fullWidth = width;
  const halfWidth = (width - gap) / 2;

  const rows: { photos: Photo[]; index: number[] }[] = [];
  let i = 0;
  let full = true;
  while (i < photos.length) {
    if (full || i === photos.length - 1) {
      rows.push({ photos: [photos[i]], index: [i] });
      i += 1;
    } else {
      rows.push({ photos: [photos[i], photos[i + 1]], index: [i, i + 1] });
      i += 2;
    }
    full = !full;
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.photos.map((photo, cellIndex) => {
            const photoIndex = row.index[cellIndex];
            const isFullRow = row.photos.length === 1;
            return (
              <Pressable
                key={photo.id}
                onPress={() => onPressPhoto(photoIndex)}
                accessibilityRole="button"
                accessibilityLabel={t.a11y.galleryImage(photoIndex + 1)}
                style={{
                  width: isFullRow ? fullWidth : halfWidth,
                  height: isFullRow ? 375 : 187.5,
                }}
              >
                {/* Плитка декоративна: Pressable вокруг неё уже объявлен
                    скринридеру как «Изображение N». */}
                <PhotoView uri={photo.uri} style={styles.image} decorative />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 2,
  },
  row: {
    flexDirection: "row",
    gap: 2,
  },
  image: {
    flex: 1,
    backgroundColor: colors.background.chip,
  },
});
