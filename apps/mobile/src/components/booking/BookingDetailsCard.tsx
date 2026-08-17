import type { Booking } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarBlank, User } from "../icons";
import { BookingCard } from "./BookingCard";

const t = getDictionary();

/**
 * «Детали» — дата со временем и число гостей, каждая строка со своей кнопкой
 * «Изменить» (макет 918:12814).
 *
 * Кнопки показываются ТОЛЬКО у брони, которую ещё можно менять. У отменённой
 * или прошедшей брони «Изменить» — обещание, которое сервер не выполнит: он
 * откажет по своей же таблице переходов, и человек получит ошибку вместо
 * объяснения. Поэтому решение принимается здесь, а не в обработчике нажатия.
 */
export function BookingDetailsCard({
  booking,
  dateTimeLabel,
  guestsLabel,
  editable,
  onEditDateTime,
  onEditGuests,
}: {
  booking: Booking;
  dateTimeLabel: string;
  guestsLabel: string;
  editable: boolean;
  onEditDateTime: () => void;
  onEditGuests: () => void;
}) {
  void booking;

  return (
    <BookingCard title={t.booking.detailsTitle}>
      <Row
        icon={<CalendarBlank size={24} color={colors.text.primary} weight="regular" />}
        label={t.booking.dateSectionTitle}
        value={dateTimeLabel}
        editable={editable}
        onEdit={onEditDateTime}
        editA11y={t.booking.editDateTimeA11y}
      />
      <Row
        icon={<User size={24} color={colors.text.primary} weight="regular" />}
        label={t.booking.guestsSectionTitle}
        value={guestsLabel}
        editable={editable}
        onEdit={onEditGuests}
        editA11y={t.booking.editGuestsA11y}
      />
    </BookingCard>
  );
}

function Row({
  icon,
  label,
  value,
  editable,
  onEdit,
  editA11y,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editable: boolean;
  onEdit: () => void;
  editA11y: string;
}) {
  return (
    <View style={styles.row}>
      {icon}
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editA11y}
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, pressed && styles.editPressed]}
        >
          <Text style={styles.editLabel}>{t.booking.edit}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  label: {
    ...typography.caption,
    color: colors.text.muted,
  },
  value: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  edit: {
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
  },
  editPressed: {
    opacity: 0.6,
  },
  editLabel: {
    ...typography.labelMedium,
    color: colors.brand.primary,
  },
});
