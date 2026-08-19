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
export function TagChips({
  tags,
  size = "default",
}: {
  tags: string[];
  /**
   * `compact` — 24 в высоту с зазором 6 между чипами (карточка события на
   * экране «Избранные», макет 602:3630). Это ОДИН размер того же чипа, а не
   * второй компонент: у карточки списка избранного меньше места, чем у карточки
   * афиши, и чип там ровно такой же, как кухня/чек у карточки заведения.
   */
  size?: "default" | "compact";
}) {
  if (tags.length === 0) return null;

  const compact = size === "compact";
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {tags.map((tag, index) => (
        <View key={`${tag}-${index}`} style={[styles.chip, compact && styles.chipCompact]}>
          <Text style={[styles.chipText, compact && styles.chipTextCompact]}>{tag}</Text>
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
  // Зазор 6 — из макета; в шкале spacing такого шага нет (4 и 8), поэтому он
  // собран из существующего токена, а не написан числом.
  rowCompact: {
    gap: spacing.xs + 2,
  },
  chipCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
  },
  // 16 строка + 4 сверху и снизу = 24 в высоту, как в макете.
  chipTextCompact: {
    ...typography.captionMedium,
  },
});
