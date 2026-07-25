import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ArrowLeft } from "./icons";
import { IconButton } from "./IconButton";

const t = getDictionary();

interface FlowHeaderProps {
  title: string;
  onBack: () => void;
  /** Optional trailing control, e.g. "Очистить" on the pre-order screen. */
  trailing?: React.ReactNode;
}

/**
 * Back arrow + centred title for the reservation-flow screens. Centred means
 * the title is in a flexed middle column, so a long Russian title
 * ("Забронировать столик") shrinks to two lines instead of pushing the back
 * button off screen at 360px.
 */
export function FlowHeader({ title, onBack, trailing }: FlowHeaderProps) {
  return (
    <View style={styles.root}>
      <IconButton icon={ArrowLeft} accessibilityLabel={t.a11y.backButton} onPress={onBack} />
      <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.trailing}>{trailing}</View>
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
  trailing: {
    minWidth: hitSlop.minTouchTarget,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
