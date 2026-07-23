import type { MenuHighlight } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const ITEM_WIDTH = 180;
const ITEM_HEIGHT = 120;

/** "Популярное в меню" card — Figma nodes 340:2601–340:2614. */
export function MenuItemCard({ item }: { item: MenuHighlight }) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: item.photo.uri }}
        style={styles.image}
        contentFit="cover"
        accessibilityLabel={item.photo.alt}
        transition={150}
      />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.price}>{item.price}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: ITEM_WIDTH,
    gap: spacing.md,
  },
  image: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  body: {
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  name: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  description: {
    ...typography.caption,
    color: colors.text.muted,
  },
  price: {
    ...typography.itemName,
    color: colors.text.strong,
  },
});
