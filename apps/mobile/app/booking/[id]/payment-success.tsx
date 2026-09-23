import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle } from "../../../src/components/icons";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { LoadingState } from "../../../src/components/StateViews";
import { useBooking, usePreorder } from "../../../src/hooks/useBooking";
import { formatMoneyMinor } from "../../../src/lib/format";

const t = getDictionary();

/** Диаметр кружка-иконки — Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5390:8773
 * («Success», веб-кадр без статус-бара, измерено по официальному PNG-рендеру
 * `/v1/images`: REST `/v1/files/:key/nodes` весь сеанс отвечал 429, точные
 * числа узла не читались). Круг там ~64pt, глиф зеленее наших `status.*`
 * (образец экспорта дал #34C759 вместо `positiveText` #16A34A) — цвет
 * оставлен существующей ролью `status.positiveText`/`positiveSurface`
 * намеренно: разница мала, а заводить новый неподтверждённый токен из
 * приближённого замера хуже, чем переиспользовать проверенную пару. */
const ICON_SIZE = 64;

/**
 * «Предзаказ оплачен» — Figma узел 5390:8698 (мобильный, статус-бар + «Confirmation»
 * поверх шторки) / 5390:8773 (веб-кадр). Приходит сюда ТОЛЬКО из
 * `payment.tsx` через `router.replace`, когда `useKaspiPaymentFlow` сообщил
 * `phase === "paid"` — второй раз этот платёж создать нельзя, кнопка оплаты
 * тут не нужна вовсе, только чек.
 *
 * НЕСОВПАДЕНИЕ С МАКЕТОМ: строки блюд в Figma — с фотографией на каждой.
 * `PreorderLine` с сервера фото не отдаёт (`packages/api/src/types.ts`),
 * строки текстовые, как везде в приложении.
 */
export default function PaymentSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  const preorder = usePreorder(id);

  const goToBooking = React.useCallback(() => {
    router.replace({ pathname: "/booking/[id]", params: { id: id ?? "" } });
  }, [router, id]);

  if (booking.isPending || preorder.isPending) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={["top"]} style={styles.stateBody}>
          <LoadingState title={t.booking.bookingLoading} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={["top"]} style={styles.header}>
          <View style={styles.iconCircle} accessibilityElementsHidden>
            <CheckCircle size={40} color={colors.status.positiveText} weight="fill" />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {t.booking.paymentPaidTitle}
          </Text>
          <Text style={styles.subtitle}>{t.booking.paymentSuccessSubtitle}</Text>
        </SafeAreaView>

        {(preorder.data?.items ?? []).map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.rowName} numberOfLines={2}>
              {item.quantity} × {item.name}
            </Text>
            <Text style={styles.rowPrice}>{formatMoneyMinor(item.totalMinor)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={t.booking.paymentSuccessAction} size="lg" onPress={goToBooking} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  stateBody: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: colors.status.positiveSurface,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.subtle,
    borderRadius: radius.card,
  },
  rowName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  rowPrice: {
    ...typography.body,
    color: colors.text.primary,
  },
  footer: {
    padding: spacing.lg,
  },
});
