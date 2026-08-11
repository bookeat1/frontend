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
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  chip: {
    backgroundColor: colors.background.chipAlt,
    borderRadius: radius.pill,
    // В макете карточки афиши чип — полноценная метка, а не мелкая подпись:
    // 12 по горизонтали и 6 по вертикали вместо 8/2.
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipText: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
  },
});
