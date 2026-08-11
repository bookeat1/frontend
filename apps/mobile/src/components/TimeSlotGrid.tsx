import type { AvailabilitySlot } from "@bookeat/api";
import {
  borderWidth,
  colors,
  controlHeight,
  radius,
  spacing,
  typography,
} from "@bookeat/design-tokens";
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
 * An unavailable slot is shown, not hidden: the time itself is the answer, and
 * a gap in the grid would read as "this hour does not exist". The reason lives
 * in the accessibility label only — printed in every circle it turned the grid
 * into a wall of repeated text. The backend returns the reason and a
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
            {/* Причина отказа больше НЕ пишется в кружке: «Слишком близко ко
                времени» в каждом из десяти слотов превращало сетку в стену
                текста. Недоступный слот просто нельзя нажать и он приглушён, а
                полная причина остаётся у скринридера в accessibilityLabel. */}
            {slot.available && slot.freeTables > 0 && slot.freeTables <= 3 ? (
              <Text style={[styles.hint, active && styles.timeActive]} numberOfLines={1}>
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
    // Four per row, 48 tall, outlined pill — Figma node 471:3914. The width is
    // a share of the row rather than a fixed 80 so it also lands inside a
    // 360pt screen (23% of 304 = 70), and flexGrow stays off so a half-empty
    // last row keeps slot-sized slots instead of stretching them.
    flexBasis: "23%",
    minHeight: controlHeight.pill,
    borderRadius: radius.pill,
    borderWidth: borderWidth.control,
    borderColor: colors.border.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
  },
  // The design draws available slots only, so this state is ours: a filled
  // grey pill with muted text, which reads as "not tappable" without inventing
  // a new colour.
  slotDisabled: {
    backgroundColor: colors.background.screen,
    borderColor: colors.background.screen,
  },
  slotActive: {
    borderColor: colors.brand.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  time: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  timeDisabled: {
    color: colors.text.muted,
  },
  // Chosen slot: brand outline AND brand text, no fill (node 471:3914).
  timeActive: {
    color: colors.brand.primary,
  },
  hint: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: "center",
  },
});
