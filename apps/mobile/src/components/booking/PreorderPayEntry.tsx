import type { BookingPayment } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatMoneyMinor } from "../../lib/format";
import { formatCountdown, remainingMs } from "../../lib/kaspi-payment";
import { PrimaryButton } from "../PrimaryButton";
import { BookingCard } from "./BookingCard";

const t = getDictionary();

/**
 * Компактная строка на экране брони: вход обратно в шторку оплаты, если гость
 * её закрыл. Блок «Оплата предзаказа» убран по макету намеренно, поэтому здесь
 * только одна строка с кнопкой, а не карточка с составом заказа.
 * `payment` — живой платёж (есть отсчёт), `null` — платежа нет.
 */
export function PreorderPayEntry({
  payment,
  amountMinor,
  now,
  onPay,
}: {
  payment: BookingPayment | null;
  amountMinor: number | null;
  now: number;
  onPay: () => void;
}) {
  const left = payment ? remainingMs(payment.expiresAt, now) : null;
  const title =
    left !== null ? t.booking.paymentEntryWaiting(formatCountdown(left)) : payment ? t.booking.paymentAwaitingTitle : t.booking.paymentEntryUnpaid;
  const label = amountMinor !== null ? t.booking.paymentPayAmount(formatMoneyMinor(amountMinor)) : t.booking.paymentPay;
  return (
    <BookingCard>
      <View testID="preorder-pay-entry" style={styles.row}>
        <Text style={styles.title} accessibilityRole="text">
          {title}
        </Text>
        <PrimaryButton label={label} size="lg" onPress={onPay} />
      </View>
    </BookingCard>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.md },
  title: { ...typography.body, color: colors.text.primary },
});
