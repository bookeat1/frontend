import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * The three-cell stats row under the identity block: a number over its label.
 *
 * Only «Брони» has a backend behind it (`GET /bookings`, the same list the
 * bookings screen reads); «Отзывов» and «Друзья» have none yet and are passed a
 * real 0, not a plausible-looking number — a stat the guest cannot verify and
 * we cannot source is the same deceit as a fake filter. See profile.tsx for the
 * wiring and the track-C notes.
 *
 * The «Брони» cell is a real control: it opens the «Мои брони» list — the same
 * destination as the bottom-nav tab — so the count is a shortcut, not just a
 * number. The other two cells have nowhere to go yet and stay inert.
 */
export function ProfileStats({
  bookings,
  reviews,
  friends,
  labels,
  onPressBookings,
}: {
  bookings: number;
  reviews: number;
  friends: number;
  labels: { bookings: string; reviews: string; friends: string };
  /** Opens «Мои брони»; omit to leave the cell inert. */
  onPressBookings?: () => void;
}) {
  return (
    <View style={styles.root} accessibilityRole="summary">
      <StatCell value={bookings} label={labels.bookings} onPress={onPressBookings} />
      <View style={styles.divider} />
      <StatCell value={reviews} label={labels.reviews} />
      <View style={styles.divider} />
      <StatCell value={friends} label={labels.friends} />
    </View>
  );
}

function StatCell({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.cell}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
    >
      {body}
    </Pressable>
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
  cellPressed: {
    opacity: 0.6,
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
