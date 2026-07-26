import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ArrowLeft, X } from "./icons";
import { IconButton } from "./IconButton";

const t = getDictionary();

interface FlowHeaderProps {
  title: string;
  /** Omit to hide the back arrow — the slot keeps its width so the title stays
   * optically centred (Reservation has only a close control, node 471:3880). */
  onBack?: () => void;
  /** Renders an X on the right. Same destination as the arrow, different
   * affordance: "leave the flow" rather than "one step back". */
  onClose?: () => void;
  /** Optional trailing control, e.g. "Очистить" on the pre-order screen. Wins
   * over `onClose` when both are given. */
  trailing?: React.ReactNode;
}

/**
 * Centred title with an optional back arrow on the left and an optional close
 * X on the right — 56pt tall, white, no bottom border (Figma node 471:3880).
 * Centred means the title is in a flexed middle column, so a long Russian title
 * ("Забронировать столик") shrinks to two lines instead of pushing the buttons
 * off screen at 360px.
 */
export function FlowHeader({ title, onBack, onClose, trailing }: FlowHeaderProps) {
  return (
    <View style={styles.root}>
      {onBack ? (
        <IconButton icon={ArrowLeft} accessibilityLabel={t.a11y.backButton} onPress={onBack} />
      ) : (
        <View style={styles.slot} />
      )}
      <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.trailing}>
        {trailing ??
          (onClose ? (
            <IconButton icon={X} accessibilityLabel={t.a11y.closeButton} onPress={onClose} />
          ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background.surface,
  },
  title: {
    ...typography.titleMd,
    color: colors.text.primary,
    flex: 1,
    textAlign: "center",
  },
  slot: {
    width: hitSlop.minTouchTarget,
  },
  trailing: {
    minWidth: hitSlop.minTouchTarget,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
