import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { XCircle } from "../../../src/components/icons";
import { PrimaryButton } from "../../../src/components/PrimaryButton";

const t = getDictionary();

/** См. `payment-success.tsx` про происхождение размера/цвета — тот же
 * замер того же файла, узел 5390:9217 («Error», веб-кадр). Глиф там красный
 * #FF383C, почти совпадает с `status.negativeTextOnSurface` (#B33036 —
 * версия для белого листа, см. её же комментарий в colors.ts), эта роль и
 * переиспользована вместо нового неподтверждённого токена. */
const ICON_SIZE = 64;

/**
 * «Оплата не прошла» — Figma узел 5390:9142 (мобильный) / 5390:9217 (веб).
 * Терминальная (`dead`) фаза `useKaspiPaymentFlow`, но со СВОИМ набором
 * кнопок: в отличие от инлайн-карточки (`paymentDeadTitle` → одна кнопка
 * «Создать новую ссылку», которая молча создаёт следующий счёт), макет даёт
 * ДВЕ — «Повторить попытку» ведёт назад на экран оплаты (там `renew()`
 * заведёт новый счёт по нажатию, а не автоматически), «Вернуться к брони» —
 * на бронь без новой попытки.
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
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.body}>
        <View style={styles.iconCircle} accessibilityElementsHidden>
          <XCircle size={40} color={colors.status.negativeTextOnSurface} weight="fill" />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t.booking.paymentFailedTitle}
        </Text>
        <Text style={styles.subtitle} accessibilityRole="alert">
          {t.booking.paymentFailedText}
        </Text>
      </SafeAreaView>

      <View style={styles.footer}>
        <PrimaryButton label={t.booking.paymentFailedRetry} size="lg" onPress={retry} />
        <PrimaryButton
          label={t.booking.paymentFailedBackToBooking}
          variant="secondary"
          size="lg"
          onPress={backToBooking}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
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
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
