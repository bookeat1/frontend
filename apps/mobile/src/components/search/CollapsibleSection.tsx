import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretDown, CaretUp } from "../icons";

interface CollapsibleSectionProps {
  title: string;
  /** Right-side summary of the current selection, e.g. «Не выбрано» / «3
   * выбрано». Coloured brand-red once something is chosen (matches the PNG). */
  summary: string;
  /** Whether the summary should read as "has a selection" (brand-red) or empty
   * (muted). */
  hasSelection: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** The chips / checkbox rows shown when the section is open. */
  children: React.ReactNode;
}

/**
 * A section whose header stays visible and whose body folds away — «Кухня» and
 * «Удобства» in the Filters sheet share this exact pattern: a left title, a
 * right summary of how many are picked, and a caret that flips up when open.
 * One primitive for both so the two rows can't drift apart.
 */
export function CollapsibleSection({
  title,
  summary,
  hasSelection,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  const Caret = expanded ? CaretUp : CaretDown;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}: ${summary}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Text style={styles.title}>{title}</Text>
        <View style={styles.right}>
          <Text style={[styles.summary, hasSelection && styles.summaryActive]}>{summary}</Text>
          <Caret size={20} color={colors.text.primary} weight="regular" />
        </View>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: hitSlop.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    ...typography.titleSm,
    color: colors.text.primary,
    flexShrink: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  summary: {
    ...typography.labelMedium,
    color: colors.text.muted,
  },
  summaryActive: {
    color: colors.brand.primary,
  },
  body: {
    marginTop: spacing.md,
  },
});
