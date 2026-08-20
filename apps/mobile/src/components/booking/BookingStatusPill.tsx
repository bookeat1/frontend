import type { BookingStatus } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const t = getDictionary();

/**
 * The status pill: under the venue name on the Reservation detail screen
 * (Figma node 488:9876, `size="default"`) and in the top-right corner of a
 * row of «Мои брони» (Figma dVjT37j984ErvOmzxlx29p, node 3004:6814,
 * `size="compact"` — 28 tall, 12pt label, вместо 32 и 14pt).
 *
 * The reservation design only draws two of them — amber "Pending Confirmation"
 * and green "Confirmed"; «Мои брони» adds the red "Cancelled". Every other
 * status the backend can return
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

/** Боковой отступ компактной пилюли (node 3004:6814) — 10, вне 4pt-шкалы,
 * поэтому число живёт здесь, а не в `spacing`. */
const COMPACT_PADDING_HORIZONTAL = 10;

export function BookingStatusPill({
  status,
  size = "default",
}: {
  status: BookingStatus;
  /** `compact` — вариант из списка броней. По умолчанию прежний размер, чтобы
   * экран деталки брони остался нетронутым. */
  size?: "default" | "compact";
}) {
  const tone = TONE_STYLES[toneForStatus(status)];
  const label = t.booking.status[status];
  const compact = size === "compact";
  return (
    <View
      style={[styles.pill, compact && styles.pillCompact, { backgroundColor: tone.backgroundColor }]}
    >
      {/* Read out as "Статус: Подтверждена" instead of a bare adjective. */}
      <Text
        style={[styles.label, compact && styles.labelCompact, { color: tone.color }]}
        // Длинный русский статус переносится, а не обрезается: «Ждёт
        // подтвержде…» — это не статус, это загадка.
        numberOfLines={compact ? 2 : 1}
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
  pillCompact: {
    minHeight: controlHeight.compactPill,
    paddingHorizontal: COMPACT_PADDING_HORIZONTAL,
    paddingVertical: spacing.xs + spacing.xxs,
    // В строке списка пилюля прижата к верхнему правому углу карточки, а не
    // отцентрована по колонке, как на деталке.
    alignSelf: "flex-start",
    // Потолок ширины — единственное, что спасает строку на 360 px. В макете
    // статус называется «Pending» (7 знаков), по-русски — «Ждёт
    // подтверждения» (18). Без потолка пилюля забирает почти половину
    // карточки, и на название заведения остаётся два слога. С ним подпись
    // переносится на вторую строку, а название и дата остаются читаемыми.
    maxWidth: "40%",
  },
  label: {
    ...typography.labelSemiBold,
    textAlign: "center",
  },
  labelCompact: {
    ...typography.captionMedium,
  },
});
