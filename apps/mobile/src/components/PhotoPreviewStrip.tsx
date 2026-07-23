import type { Photo } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const t = getDictionary();

interface PhotoPreviewStripProps {
  photos: Photo[];
  onPressPhoto: (index: number) => void;
  onSeeAll: () => void;
}

const THUMB_SIZE = 96;

export function PhotoPreviewStrip({ photos, onPressPhoto, onSeeAll }: PhotoPreviewStripProps) {
  if (photos.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t.restaurant.photos} · {t.restaurant.photosCount(photos.length)}
        </Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>{t.common.seeAll}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {photos.map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => onPressPhoto(index)}
              accessibilityRole="button"
              accessibilityLabel={t.a11y.galleryImage(index + 1)}
            >
              <Image
                source={{ uri: photo.uri }}
                style={styles.thumb}
                contentFit="cover"
                accessibilityLabel={photo.alt}
                transition={150}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  seeAll: {
    ...typography.bodyMedium,
    color: colors.brand.primary,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
});
