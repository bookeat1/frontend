import { colors, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { formatMoneyMinor } from "../../lib/format";
import { PrimaryButton } from "../PrimaryButton";
import { BookingCard } from "./BookingCard";

const t = getDictionary();

/**
 * Точка входа в полноэкранную оплату предзаказа (Figma qmMsg4jO1ggmyEHNIAD2ll,
 * узел 5390:8875) с экрана брони — сама оплата (счёт, отсчёт, «я оплатил»)
 * теперь рисуется на `app/booking/[id]/payment`, этот блок только зовёт туда.
 *
 * Рисуется ТОЛЬКО пока новый счёт можно (пере)начать (`paymentGate.payable`);
 * уже оплаченный/дожимаемый предзаказ показывает вместо этого
 * `PreorderPaymentCard` как чек — см. комментарий в `app/booking/[id]/index.tsx`.
 */
export function PreorderPaymentEntryCard({
  amountMinor,
  onPress,
}: {
  /** Сумма предзаказа — тийины. `null`, пока сервер её ещё не посчитал. */
  amountMinor: number | null;
  onPress: () => void;
}) {
  const amount = amountMinor === null ? null : formatMoneyMinor(amountMinor);
  return (
    <BookingCard title={t.booking.paymentSectionTitle}>
      <Text style={styles.hint}>{t.booking.paymentIntro}</Text>
      <PrimaryButton
        label={amount ? t.booking.paymentEntryCta(amount) : t.booking.paymentPayWithKaspi}
        size="lg"
        onPress={onPress}
      />
    </BookingCard>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.body,
    color: colors.text.muted,
  },
});
