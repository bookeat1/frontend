import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * The three-cell stats row under the identity block: a number over its label.
 *
 * Only «Брони» has a backend behind it (`GET /bookings`, the same list the
 * bookings screen reads); «Отзывов» and «Друзья» have none yet and are passed a
 * real 0, not a plausible-looking number — a stat the guest cannot verify and
 * we cannot source is the same deceit as a fake filter. See profile.tsx for the
 * wiring and the track-C notes.
 */
export function ProfileStats({
  bookings,
  reviews,
  friends,
  labels,
}: {
  bookings: number;
  reviews: number;
  friends: number;
  labels: { bookings: string; reviews: string; friends: string };
}) {
  return (
    <View style={styles.root} accessibilityRole="summary">
      <StatCell value={bookings} label={labels.bookings} />
      <View style={styles.divider} />
      <StatCell value={reviews} label={labels.reviews} />
      <View style={styles.divider} />
      <StatCell value={friends} label={labels.friends} />
    </View>
  );
}

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xxs,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: spacing.xs,
    backgroundColor: colors.border.control,
  },
  value: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  label: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
