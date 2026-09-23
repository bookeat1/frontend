import { isCancellableBookingStatus, RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../src/components/FlowHeader";
import { KaspiPayButton } from "../../../src/components/booking/KaspiPayButton";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../../src/components/StateViews";
import { useBooking, useBookingPayment, usePreorder } from "../../../src/hooks/useBooking";
import { useRestaurant } from "../../../src/hooks/useRestaurant";
import { useKaspiPaymentFlow } from "../../../src/hooks/useKaspiPayment";
import { useAuth } from "../../../src/lib/auth";
import { openWebsite } from "../../../src/lib/external-links";
import { formatMoneyMinor } from "../../../src/lib/format";
import {
  formatCountdown,
  paymentReturnUrl,
  preorderPaymentGate,
  remainingMs,
} from "../../../src/lib/kaspi-payment";

const t = getDictionary();

/**
 * Полноэкранная оплата предзаказа — Figma qmMsg4jO1ggmyEHNIAD2ll, узел
 * 5390:8875 («Pre-order / Payment», мобильный кадр со статус-баром: в макете
 * это модальная шторка ПОВЕРХ экрана «Confirmation», здесь — отдельный
 * маршрут: задача просит именно полноэкранные экраны, а не шторку).
 *
 * Экран держит ТРИ фазы существующей машины состояний Kaspi (idle/awaiting/
 * settling) — `paid` и `dead` уводят гостя на отдельные экраны-развязки
 * (`payment-success` / `payment-error`, узлы 8773/8698 и 9217/9142) через
 * `router.replace`, чтобы нельзя было вернуться сюда кнопкой «назад» на уже
 * решённый платёж.
 *
 * НЕСОВПАДЕНИЕ С МАКЕТОМ, зафиксированное намеренно: узел рисует строку
 * «Способ оплаты» с выбором карты («Карта •••• 4242», «Изменить»). В бэкенде
 * нет сохранённых карт и нет реального выбора способа — а провайдер зависит
 * от заведения (не всегда Kaspi, например TipTopPay у Abay), так что называть
 * конкретный бренд здесь было бы неверно. Строка убрана целиком, кнопка ниже
 * называется просто «Оплатить» (правка владельца 2026-09-23).
 * Список блюд в макете — с фотографией на каждой строке; `PreorderLine` с
 * сервера фото не отдаёт (`packages/api/src/types.ts`), поэтому строки
 * текстовые, как и везде в приложении.
 */
export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status: authStatus } = useAuth();

  const booking = useBooking(id);
  const restaurant = useRestaurant(booking.data?.restaurantId);
  const preorder = usePreorder(id);
  const payment = useBookingPayment(id, true);

  const preorderItemsCount = preorder.data?.items.length ?? 0;
  const paymentGate = preorderPaymentGate({
    bookingIsLive: booking.data ? isCancellableBookingStatus(booking.data.status) : false,
    preorderItemsCount,
    venueAcceptsOnlinePayment: restaurant.data?.acceptsOnlinePayment === true,
    existingPayment: payment.isError ? null : payment.data,
  });

  const paymentFlow = useKaspiPaymentFlow({
    bookingId: id ?? "",
    returnUrl: paymentReturnUrl(id ?? ""),
    existing: payment.isError ? null : payment.data,
    enabled: Boolean(id) && Boolean(booking.data),
  });
  const [openFailed, setOpenFailed] = React.useState(false);

  // Тот же приём, что раньше жил на экране брони: счёт создан — гостя сразу
  // уводим в Kaspi, а не заставляем нажимать вторую кнопку. Один раз на счёт.
  const autoOpened = React.useRef<string | null>(null);
  const paymentUrl = paymentFlow.payment?.paymentUrl ?? null;
  const paymentIdForOpen = paymentFlow.payment?.id ?? null;
  const paymentStatus = paymentFlow.payment?.status ?? null;
  const openPaymentLink = React.useCallback(async () => {
    if (!paymentUrl) return;
    const opened = await openWebsite(paymentUrl);
    setOpenFailed(!opened);
  }, [paymentUrl]);
  React.useEffect(() => {
    if (!paymentIdForOpen || !paymentUrl || paymentStatus !== "created") return;
    if (autoOpened.current === paymentIdForOpen) return;
    autoOpened.current = paymentIdForOpen;
    setOpenFailed(false);
    void openPaymentLink();
  }, [paymentIdForOpen, paymentStatus, paymentUrl, openPaymentLink]);

  // Платёж решён — экран оплаты больше не нужен. `replace`, а не `push`: с
  // развязки «назад» должно вести к брони, не обратно на этот же счёт.
  //
  // «Повторить попытку» на развязке-ошибке ведёт СЮДА ЖЕ (`payment-error.tsx`
  // → `router.replace("/booking/[id]/payment")`) — это безопасно, потому что
  // `useKaspiPaymentFlow` на свежем монтировании не помнит мёртвый счёт
  // прошлой попытки (его `paymentId` стартует с `null`, а `GET
  // /bookings/:id/payment` отдаёт только ЖИВОЙ платёж — просроченный/
  // отклонённый в ответе не приедет), поэтому фаза здесь снова `idle`, а не
  // `dead`. Единственное узкое исключение — статус `voided`: он числится и
  // «живым» для ручки, и «мёртвым» для `paymentPhase()`; тогда эффект ниже
  // сразу же уводит обратно на `payment-error`. Отдельного экрана для этого
  // руки не хватило — если он станет частым, разговор про `existing` этой
  // ручки на новом монтировании.
  const phase = paymentFlow.phase;
  React.useEffect(() => {
    if (phase === "paid") {
      router.replace({ pathname: "/booking/[id]/payment-success", params: { id: id ?? "" } });
    } else if (phase === "dead") {
      router.replace({ pathname: "/booking/[id]/payment-error", params: { id: id ?? "" } });
    }
  }, [phase, router, id]);

  const leave = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({ pathname: "/booking/[id]", params: { id: id ?? "" } });
  }, [router, id]);

  const header = (
    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
      <FlowHeader title={t.booking.paymentSectionTitle} onClose={leave} />
    </SafeAreaView>
  );

  if (authStatus !== "signed-in" || booking.isPending) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.stateBody}>
          <LoadingState title={t.booking.bookingLoading} />
        </View>
      </View>
    );
  }

  if (booking.isError || !booking.data) {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.stateBody}>
          <ErrorState
            title={t.booking.bookingErrorTitle}
            description={t.search.errorDescription}
            action={{ label: t.common.retry, onPress: () => void booking.refetch(), variant: "button" }}
          />
        </View>
      </View>
    );
  }

  // Сюда попадают только по кнопке входа со страницы брони, но прямая
  // ссылка/возврат по устаревшему deep link на уже неплатёжеспособную бронь
  // должны показать честное «платить нечего», а не пустой экран.
  if (!paymentGate.payable && phase !== "settling") {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.stateBody}>
          <EmptyState
            title={t.booking.paymentErrorUnavailable}
            description={t.booking.paymentIntro}
            action={{ label: t.booking.backToHome, onPress: leave, variant: "button" }}
          />
        </View>
      </View>
    );
  }

  const amountMinor = paymentFlow.payment?.amountMinor ?? preorder.data?.totalMinor ?? null;
  const amount = amountMinor === null ? null : formatMoneyMinor(amountMinor);
  const left = remainingMs(paymentFlow.payment?.expiresAt ?? null, paymentFlow.now);
  const failure = createFailureMessage(paymentFlow.error);

  return (
    <View style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Заголовок «Оплата предзаказа» уже несёт `FlowHeader` выше — как на
            остальных экранах брони (см. `booking/[id]/index.tsx`), здесь он
            не повторяется вторым H1, только название заведения. */}
        {restaurant.data ? (
          <Text style={styles.subtitle} accessibilityRole="header">
            {restaurant.data.name}
          </Text>
        ) : null}

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryHeaderLabel}>{t.booking.preorderSummaryTitle}</Text>
            {amount ? <Text style={styles.summaryHeaderAmount}>{amount}</Text> : null}
          </View>
          <View style={styles.summaryList}>
            {(preorder.data?.items ?? []).map((item) => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryRowName} numberOfLines={2}>
                  {item.quantity} × {item.name}
                </Text>
                <Text style={styles.summaryRowPrice}>{formatMoneyMinor(item.totalMinor)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.note}>{t.booking.paymentCheckoutNote}</Text>

        {phase === "settling" ? <Text style={styles.strong}>{t.booking.paymentSettlingTitle}</Text> : null}

        {phase === "awaiting" ? (
          <View style={styles.awaitingBlock}>
            <Text style={styles.strong}>{t.booking.paymentAwaitingTitle}</Text>
            {left !== null ? (
              <Text style={styles.countdown} accessibilityRole="text">
                {t.booking.paymentCountdown(formatCountdown(left))}
              </Text>
            ) : null}
            <PrimaryButton
              label={t.booking.paymentOpenAgain}
              size="lg"
              onPress={() => void openPaymentLink()}
              accessibilityHint={t.booking.paymentOpensExternally}
            />
            <PrimaryButton
              label={t.booking.paymentCheckAgain}
              variant="secondary"
              size="lg"
              onPress={paymentFlow.check}
            />
          </View>
        ) : null}

        {phase === "idle" ? (
          <KaspiPayButton
            label={amount ? t.booking.paymentPayAmount(amount) : t.booking.paymentPay}
            busy={paymentFlow.creating}
            onPress={paymentFlow.pay}
            accessibilityHint={t.booking.paymentOpensExternally}
          />
        ) : null}

        {failure ? (
          <Text style={styles.error} accessibilityRole="alert">
            {failure}
          </Text>
        ) : null}
        {openFailed ? (
          <Text style={styles.error} accessibilityRole="alert">
            {t.booking.paymentErrorCannotOpen}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Тот же разбор по HTTP-статусу, что у инлайн-карточки — см. её комментарий. */
function createFailureMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof RepositoryError) {
    if (error.isOffline) return t.booking.paymentErrorOffline;
    if (error.status === 409) return t.booking.paymentErrorAlreadyActive;
    if (error.status === 422) return t.booking.paymentErrorUnavailable;
  }
  return t.booking.paymentErrorServer;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  stateBody: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xxl,
  },
  subtitle: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  summaryCard: {
    backgroundColor: colors.background.chipAlt,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.md,
  },
  summaryHeader: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  summaryHeaderLabel: {
    ...typography.body,
    color: colors.text.onDark,
    flex: 1,
  },
  summaryHeaderAmount: {
    ...typography.titleMd,
    color: colors.text.onDark,
  },
  summaryList: {
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryRowName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  summaryRowPrice: {
    ...typography.body,
    color: colors.text.primary,
  },
  note: {
    ...typography.caption,
    color: colors.text.muted,
  },
  strong: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  awaitingBlock: {
    gap: spacing.md,
  },
  countdown: {
    ...typography.body,
    color: colors.text.primary,
  },
  error: {
    ...typography.caption,
    color: colors.brand.primary,
  },
});
