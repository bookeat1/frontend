import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ForkKnife } from "../icons";
import { BookingCard } from "./BookingCard";

/**
 * Compact entry into the dish picker («Добавить предзаказ» / «Изменить
 * предзаказ»). One row, not a card with the order inside: the composition lives
 * on the menu screen. Shared by the confirmation step and the booking page.
 */
export function AddPreorderRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <BookingCard>
      <Pressable
        testID="add-preorder-row"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={styles.row}
      >
        <ForkKnife size={20} color={colors.brand.primary} />
        <View style={styles.textWrap}>
          <Text style={styles.label}>{label}</Text>
        </View>
      </Pressable>
    </BookingCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: hitSlop.minTouchTarget },
  textWrap: { flex: 1 },
  label: { ...typography.labelMedium, color: colors.brand.primary },
});
