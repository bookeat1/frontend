import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * A calm row of grey label chips — the event «Афиша» tags ("Бранч", "Живая
 * музыка"). Plain text, no icon. Wraps to multiple lines when there are many.
 *
 * Renders nothing when `tags` is empty, so a caller can drop it straight under
 * the «venue · date» line without its own guard. Same neutral pill styling the
 * catalog card uses (background.chipAlt + text.mutedStrong), kept here so the
 * three event surfaces stay identical.
 */
export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <View style={styles.row}>
      {tags.map((tag, index) => (
        <View key={`${tag}-${index}`} style={styles.chip}>
          <Text style={styles.chipText}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  chip: {
    backgroundColor: colors.background.chipAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  chipText: {
    ...typography.captionMedium,
    color: colors.text.mutedStrong,
  },
});
