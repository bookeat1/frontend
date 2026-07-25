import type { AvailabilitySlot } from "@bookeat/api";
import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatTime } from "../lib/format";

const t = getDictionary();

interface TimeSlotGridProps {
  slots: AvailabilitySlot[];
  /** `startsAt` of the chosen slot, or null. */
  selected: string | null;
  onSelect: (slot: AvailabilitySlot) => void;
}

/**
 * The time grid.
 *
 * An unavailable slot is shown, not hidden, and carries its reason as a
 * caption — the backend returns a reason for exactly this purpose, and a
 * grid that silently drops half its times reads as broken data. `freeTables`
 * is deliberately NOT used to decide anything: a venue with no table rows
 * reports 0 for every slot while the table-less booking mode is being built
 * server-side, so `available` is the only signal, and the count is shown only
 * as a "hurry up" hint when it is small and positive.
 */
export function TimeSlotGrid({ slots, selected, onSelect }: TimeSlotGridProps) {
  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const active = slot.startsAt === selected;
        const reasonLabel = slot.reason ? t.booking.slotUnavailable[slot.reason] : "";
        return (
          <Pressable
            key={slot.startsAt}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !slot.available }}
            accessibilityLabel={
              slot.available ? formatTime(slot.startsAt) : `${formatTime(slot.startsAt)}, ${reasonLabel}`
            }
            disabled={!slot.available}
            onPress={() => onSelect(slot)}
            style={({ pressed }) => [
              styles.slot,
              !slot.available && styles.slotDisabled,
              active && styles.slotActive,
              pressed && slot.available && !active && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.time,
                !slot.available && styles.timeDisabled,
                active && styles.timeActive,
              ]}
            >
              {formatTime(slot.startsAt)}
            </Text>
            {!slot.available ? (
              <Text style={styles.reason} numberOfLines={2}>
                {reasonLabel}
              </Text>
            ) : slot.freeTables > 0 && slot.freeTables <= 3 ? (
              <Text style={[styles.reason, active && styles.timeActive]} numberOfLines={1}>
                {t.booking.slotFreeTables(slot.freeTables)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  slot: {
    // Three per row at 360px with 16px page padding and 8px gaps; the reason
    // caption is what forces the taller-than-a-chip minimum height.
    minWidth: 96,
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: hitSlop.minTouchTarget + spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  slotDisabled: {
    backgroundColor: colors.background.screen,
  },
  slotActive: {
    backgroundColor: colors.brand.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  time: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  timeDisabled: {
    color: colors.text.muted,
  },
  timeActive: {
    color: colors.text.onBrand,
  },
  reason: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: "center",
  },
});
