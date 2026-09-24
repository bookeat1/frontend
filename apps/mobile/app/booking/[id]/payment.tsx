import { isCancellableBookingStatus, RepositoryError, type PaymentMethod } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RouteSheet } from "../../../src/components/booking/RouteSheet";
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
 * это модальная шторка ПОВЕРХ предыдущего экрана. С 2026-09-24 так и
 * есть: маршрут `transparentModal` (`app/_layout.tsx`) + `RouteSheet`).
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
  // `null` — старый бэкенд без `payment_methods`: одна кнопка «Оплатить» без
  // `method`, как раньше.
  const methodButtons: PaymentMethod[] = restaurant.data?.paymentMethods ?? [];
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

  const [showAll, setShowAll] = React.useState(false);

  // Шторка (Figma 5387:7782): весь экран — прозрачный маршрут, панель снизу.
  // Состояния загрузки/ошибки/«платить нечего» рисуются ВНУТРИ той же панели,
  // а не отдельным экраном: гость видит один и тот же слой поверх брони.
  if (authStatus !== "signed-in" || booking.isPending) {
    return (
      <RouteSheet onClose={leave} closeLabel={t.common.close}>
        <View style={styles.stateBody}>
          <LoadingState title={t.booking.bookingLoading} />
        </View>
      </RouteSheet>
    );
  }

  if (booking.isError || !booking.data) {
    return (
      <RouteSheet onClose={leave} closeLabel={t.common.close}>
        <View style={styles.stateBody}>
          <ErrorState
            title={t.booking.bookingErrorTitle}
            description={t.search.errorDescription}
            action={{ label: t.common.retry, onPress: () => void booking.refetch(), variant: "button" }}
          />
        </View>
      </RouteSheet>
    );
  }

  // Прямая ссылка/возврат по устаревшему deep link на уже неплатёжеспособную
  // бронь должны показать честное «платить нечего», а не пустую шторку.
  if (!paymentGate.payable && phase !== "settling") {
    return (
      <RouteSheet onClose={leave} closeLabel={t.common.close}>
        <View style={styles.stateBody}>
          <EmptyState
            title={t.booking.paymentErrorUnavailable}
            description={t.booking.paymentIntro}
            action={{ label: t.booking.backToHome, onPress: leave, variant: "button" }}
          />
        </View>
      </RouteSheet>
    );
  }

  const amountMinor = paymentFlow.payment?.amountMinor ?? preorder.data?.totalMinor ?? null;
  const amount = amountMinor === null ? null : formatMoneyMinor(amountMinor);
  const left = remainingMs(paymentFlow.payment?.expiresAt ?? null, paymentFlow.now);
  const failure = createFailureMessage(paymentFlow.error);
  const items = preorder.data?.items ?? [];
  // Две кнопки «по способу» — только когда заведение подключило ОБА способа;
  // один способ или «неизвестно» (старый бэкенд) — одна кнопка «Оплатить N».
  const twoMethods = methodButtons.length >= 2;
  const singleMethod: PaymentMethod | undefined = methodButtons.length === 1 ? methodButtons[0] : undefined;
  const payAll = (method?: PaymentMethod) => {
    if (method) paymentFlow.pay(method);
    else paymentFlow.pay();
  };

  const idleButtons =
    phase === "idle" ? (
      twoMethods ? (
        methodButtons.map((method) => {
          const label = amount
            ? method === "kaspi"
              ? t.booking.paymentPayKaspiAmount(amount)
              : t.booking.paymentPayCardAmount(amount)
            : method === "kaspi"
              ? t.booking.paymentPayKaspi
              : t.booking.paymentPayCard;
          return (
            <PrimaryButton
              key={method}
              label={label}
              size="lg"
              disabled={paymentFlow.creating}
              onPress={() => payAll(method)}
              accessibilityHint={t.booking.paymentOpensExternally}
            />
          );
        })
      ) : (
        <PrimaryButton
          label={amount ? t.booking.paymentPayAmount(amount) : t.booking.paymentPay}
          size="lg"
          disabled={paymentFlow.creating}
          onPress={() => payAll(singleMethod)}
          accessibilityHint={t.booking.paymentOpensExternally}
        />
      )
    ) : null;

  return (
    <RouteSheet onClose={leave} closeLabel={t.common.close} footer={idleButtons}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {t.booking.paymentSectionTitle}
        </Text>
        {restaurant.data ? <Text style={styles.subtitle}>{restaurant.data.name}</Text> : null}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryHeaderLabel}>{t.booking.paymentPreorderSummary(items.length)}</Text>
          {amount ? <Text style={styles.summaryHeaderAmount}>{amount}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showAll }}
          onPress={() => setShowAll((v) => !v)}
          style={styles.viewAll}
        >
          <Text style={styles.viewAllLabel}>
            {showAll ? t.booking.paymentHideAll : t.booking.paymentViewAll}
          </Text>
        </Pressable>
        {showAll ? (
          <View style={styles.summaryList}>
            {items.map((item) => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryRowName} numberOfLines={2}>
                  {item.quantity} × {item.name}
                </Text>
                <Text style={styles.summaryRowPrice}>{formatMoneyMinor(item.totalMinor)}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
    </RouteSheet>
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
  stateBody: {
    minHeight: 240,
  },
  titleBlock: {
    gap: spacing.xs,
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
  summaryCard: {
    backgroundColor: colors.background.chipAlt,
    borderRadius: radius.card,
    overflow: "hidden",
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
    ...typography.labelSemiBold,
    color: colors.text.onDark,
    flex: 1,
  },
  summaryHeaderAmount: {
    ...typography.titleMd,
    color: colors.text.onDark,
  },
  viewAll: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  viewAllLabel: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  summaryList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
    textAlign: "center",
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
