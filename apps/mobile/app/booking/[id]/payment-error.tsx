import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { XCircle } from "../../../src/components/icons";
import { RouteSheet } from "../../../src/components/booking/RouteSheet";
import { PrimaryButton } from "../../../src/components/PrimaryButton";

const t = getDictionary();

/** Диаметр кружка-иконки — Figma 5390:9142/9217 («Error»). Глиф красный,
 * почти совпадает с `status.negativeTextOnSurface` (версия для белого листа) —
 * переиспользована существующая роль вместо нового неподтверждённого токена. */
const ICON_SIZE = 64;

/**
 * Шторка «Оплата не прошла» — Figma узел 5390:9142 (шторка поверх экрана,
 * с 2026-09-24; раньше — полный экран). Терминальная (`dead`) фаза
 * `useKaspiPaymentFlow`: «Повторить попытку» ведёт назад на шторку оплаты
 * (там `pay()` заведёт новый счёт по нажатию, а не автоматически),
 * «Вернуться к брони» — на бронь без новой попытки.
 */
export default function PaymentErrorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const retry = React.useCallback(() => {
    router.replace({ pathname: "/booking/[id]/payment", params: { id: id ?? "" } });
  }, [router, id]);

  const backToBooking = React.useCallback(() => {
    router.replace({ pathname: "/booking/[id]", params: { id: id ?? "" } });
  }, [router, id]);

  return (
    <RouteSheet
      onClose={backToBooking}
      closeLabel={t.common.close}
      footer={
        <>
          <PrimaryButton label={t.booking.paymentFailedRetry} size="lg" onPress={retry} />
          <PrimaryButton
            label={t.booking.paymentFailedBackToBooking}
            variant="outline"
            size="lg"
            onPress={backToBooking}
          />
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.iconCircle} accessibilityElementsHidden>
          <XCircle size={40} color={colors.status.negativeTextOnSurface} weight="fill" />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t.booking.paymentFailedTitle}
        </Text>
        <Text style={styles.subtitle} accessibilityRole="alert">
          {t.booking.paymentFailedText}
        </Text>
      </View>
    </RouteSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: colors.status.negativeSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: "center",
  },
});
