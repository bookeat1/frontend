import type { WorkingHoursEntry } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { ru } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const weekdayLabels = ru.weekdays;

export function WorkingHoursList({ hours }: { hours: WorkingHoursEntry[] }) {
  return (
    <View style={styles.container}>
      {hours.map((entry) => (
        <View key={entry.weekday} style={styles.row}>
          <Text style={styles.day}>{weekdayLabels[entry.weekday]}</Text>
          <Text style={styles.time}>
            {entry.opensAt && entry.closesAt
              ? `${entry.opensAt}–${entry.closesAt}`
              : "Выходной"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  day: {
    ...typography.body,
    color: colors.neutral[700],
  },
  time: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
});
