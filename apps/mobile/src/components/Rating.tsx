import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const t = getDictionary();

export function Rating({ value, reviewsCount }: { value: number; reviewsCount?: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.star} accessibilityElementsHidden>
        ★
      </Text>
      <Text style={styles.value}>{value.toFixed(1)}</Text>
      {reviewsCount !== undefined ? (
        <Text style={styles.reviews}>· {t.restaurant.reviewsCount(reviewsCount)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  star: {
    color: colors.semantic.warning,
    fontSize: 14,
  },
  value: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  reviews: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
