import type { RestaurantTable } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { ru } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const t = ru;

const locationLabels: Record<RestaurantTable["location"], string> = {
  hall: "Зал",
  terrace: "Терраса",
  bar: "Бар",
  vip: "VIP",
};

export function TableList({ tables }: { tables: RestaurantTable[] }) {
  return (
    <View style={styles.row}>
      {tables.map((table) => (
        <View
          key={table.id}
          style={[styles.card, !table.isAvailableNow && styles.cardUnavailable]}
        >
          <Text style={styles.seats}>{t.restaurant.tableFor(table.seats)}</Text>
          <Text style={styles.location}>{locationLabels[table.location]}</Text>
          <Text style={[styles.status, table.isAvailableNow && styles.statusAvailable]}>
            {table.isAvailableNow ? "Свободен" : "Занят"}
          </Text>
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
  },
  card: {
    minWidth: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  cardUnavailable: {
    opacity: 0.5,
  },
  seats: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  location: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  status: {
    ...typography.captionMedium,
    color: colors.neutral[500],
  },
  statusAvailable: {
    color: colors.semantic.success,
  },
});
