import type { BookingStatus } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const t = getDictionary();

/**
 * The status pill under the venue name on the Reservation detail screen
 * (Figma node 488:9876).
 *
 * The design only draws two of them — amber "Pending Confirmation" and green
 * "Confirmed". Every other status the backend can return
 * (`BookingStatus` = the exact set in domain.BookingStatus) still has to
 * render as SOMETHING, so the remaining five are mapped onto the same three
 * token pairs by meaning:
 *
 *   pending, waitlist          → amber   "the venue has not answered"
 *   confirmed, arrived         → green   "the table is yours"
 *   cancelled, no_show         → red     "the booking is dead"
 *   completed                  → grey    "over, and nothing went wrong"
 *
 * The switch is exhaustive over BookingStatus on purpose: adding a status to
 * the union makes this file fail to compile rather than silently falling into
 * a default and telling the guest something untrue.
 */
export type StatusTone = "pending" | "positive" | "negative" | "neutral";

export function toneForStatus(status: BookingStatus): StatusTone {
  switch (status) {
    case "pending":
    case "waitlist":
      return "pending";
    case "confirmed":
    case "arrived":
      return "positive";
    case "cancelled":
    case "no_show":
      return "negative";
    case "completed":
      return "neutral";
  }
}

const TONE_STYLES: Record<StatusTone, { color: string; backgroundColor: string }> = {
  pending: { color: colors.status.pendingText, backgroundColor: colors.status.pendingSurface },
  positive: { color: colors.status.positiveText, backgroundColor: colors.status.positiveSurface },
  negative: { color: colors.status.negativeText, backgroundColor: colors.status.negativeSurface },
  neutral: { color: colors.status.neutralText, backgroundColor: colors.status.neutralSurface },
};

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  const tone = TONE_STYLES[toneForStatus(status)];
  const label = t.booking.status[status];
  return (
    <View style={[styles.pill, { backgroundColor: tone.backgroundColor }]}>
      {/* Read out as "Статус: Подтверждена" instead of a bare adjective. */}
      <Text
        style={[styles.label, { color: tone.color }]}
        accessibilityLabel={`${t.booking.statusLabel}: ${label}`}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: controlHeight.statusPill,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    // Shrink-to-fit inside a centring column: without this the pill stretches
    // the full card width on Android.
    alignSelf: "center",
  },
  label: {
    ...typography.labelSemiBold,
    textAlign: "center",
  },
});
