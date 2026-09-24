import type { BookingPayment, Preorder } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatMoneyMinor } from "../../lib/format";
import { BookingCard } from "./BookingCard";

const t = getDictionary();

/**
 * Платёжная пометка «Предзаказ оплачен» рядом со статусом брони. Это НЕ статус
 * брони (тот про подтверждение рестораном): отдельная зелёная пилюля, тон и
 * размеры те же, что у `BookingStatusPill`.
 */
export function PreorderPaidPill() {
  return (
    <View style={styles.pill} testID="preorder-paid-pill">
      <Text style={styles.pillLabel} numberOfLines={2}>
        {t.booking.paymentPaidTitle}
      </Text>
    </View>
  );
}

/**
 * Компактный блок «Предзаказ» оплаченного предзаказа на экране брони: блюда
 * («2 × Борщ», цена) и итог. Есть разбивка сервера (блюда/сбор) — она; нет
 * (старый бэкенд) — только итог по сумме платежа.
 */
export function PreorderPaidBlock({ preorder, payment }: { preorder: Preorder; payment: BookingPayment }) {
  const fee = payment.feeMinor ?? 0;
  const base = payment.baseAmountMinor;
  const showBreakdown = fee > 0 && base !== undefined;
  return (
    <BookingCard title={t.booking.preorderSectionTitle}>
      <View style={styles.list} testID="preorder-paid-block">
        {preorder.items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.name} numberOfLines={2}>
              {item.quantity} × {item.name}
            </Text>
            <Text style={styles.price}>{formatMoneyMinor(item.totalMinor)}</Text>
          </View>
        ))}
        {showBreakdown ? (
          <>
            <View style={styles.row}>
              <Text style={styles.name}>{t.booking.paymentBreakdownDishes}</Text>
              <Text style={styles.price}>{formatMoneyMinor(base)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.name}>{t.booking.paymentBreakdownFee}</Text>
              <Text style={styles.price}>{formatMoneyMinor(fee)}</Text>
            </View>
          </>
        ) : null}
        <View style={styles.row}>
          <Text style={[styles.name, styles.strong]}>{t.booking.paymentBreakdownTotal}</Text>
          <Text style={[styles.price, styles.strong]} testID="preorder-paid-total">
            {formatMoneyMinor(payment.amountMinor)}
          </Text>
        </View>
      </View>
    </BookingCard>
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
    alignSelf: "center",
    backgroundColor: colors.status.positiveSurface,
  },
  pillLabel: { ...typography.labelSemiBold, color: colors.status.positiveText, textAlign: "center" },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  name: { ...typography.body, color: colors.text.primary, flex: 1, flexShrink: 1 },
  price: { ...typography.body, color: colors.text.primary },
  strong: { ...typography.labelSemiBold },
});
