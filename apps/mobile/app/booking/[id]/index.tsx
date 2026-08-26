import {
  canGuestCancel,
  isCancellableBookingStatus,
  isRebookableBooking,
  isTerminalBookingStatus,
  RepositoryError,
} from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookingCard } from "../../../src/components/booking/BookingCard";
import { CancelBookingDialog } from "../../../src/components/booking/CancelBookingDialog";
import { describeCancellationCost } from "../../../src/components/booking/cancellation-cost";
import { BookingDetailsCard } from "../../../src/components/booking/BookingDetailsCard";
import { ContactsCard, hasAnyContact } from "../../../src/components/booking/ContactsCard";
import { PushOptInCard } from "../../../src/components/booking/PushOptInCard";
import { ReservationHeaderCard } from "../../../src/components/booking/ReservationHeaderCard";
import { WhatHappensNextCard } from "../../../src/components/booking/WhatHappensNextCard";
import { FlowHeader } from "../../../src/components/FlowHeader";
import { XCircle } from "../../../src/components/icons";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../../src/components/StateViews";
import {
  useBooking,
  useBookingPayment,
  useCancelBooking,
  usePreorder,
} from "../../../src/hooks/useBooking";
import { useRestaurant } from "../../../src/hooks/useRestaurant";
import { useAuth } from "../../../src/lib/auth";
import { formatMoneyMinor, formatRelativeDay, formatTime } from "../../../src/lib/format";

const t = getDictionary();

/**
 * Reservation — the guest's view of one booking, and the entry point to
 * cancelling it (Figma file oPxXynSOY3PYhf3gkVR5Ps, section "Reservation
 * Cancel Flow", node 488:9876).
 *
 * The booking is re-read from the server rather than trusting whatever the
 * create call returned: a venue that auto-confirms and one that answers
 * `pending` must both show the truth, and a deep link into this screen works
 * with no create call at all.
 *
 * Four states, all present: loading / error (with retry) / the booking / the
 * cancelled booking. There is no "empty" — a booking id either resolves or it
 * doesn't, and a 404 is the error state.
 *
 * Two independent queries feed the screen. Only the BOOKING may fail it: the
 * venue read (name, photo, contacts, coordinates) degrades to a header with no
 * photo and no contacts card, because a broken catalog request must not hide a
 * guest's own reservation.
 *
 * `preorderFailed=1` is passed by the reservation flow when the booking was
 * created but attaching the pre-order failed. That is NOT a failed booking —
 * the table is held — so it renders as a notice, not as an error state.
 */
export default function ReservationScreen() {
  const { id, preorderFailed, created } = useLocalSearchParams<{
    id: string;
    preorderFailed?: string;
    created?: string;
  }>();
  const router = useRouter();
  const { status: authStatus } = useAuth();

  const booking = useBooking(id);
  const restaurant = useRestaurant(booking.data?.restaurantId);
  const preorder = usePreorder(id);

  const canCancel = booking.data ? canGuestCancel(booking.data) : false;
  // Статус ещё позволяет отмену (бронь жива), даже если двухчасовое окно уже
  // закрылось: от этого зависит, показывать ли блок отмены вообще.
  const cancellable = booking.data ? isCancellableBookingStatus(booking.data.status) : false;
  const payment = useBookingPayment(id, canCancel);
  const cancel = useCancelBooking();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const restaurantId = booking.data?.restaurantId;
  // "Leave this screen". The flow that led here was replaced, so when there is
  // nothing to pop we go to the venue rather than dead-ending.
  const leave = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(restaurantId ? `/restaurant/${restaurantId}` : "/");
  }, [router, restaurantId]);

  // The header is rendered in EVERY branch, not only the successful one: a
  // screen that can be reached by deep link (and whose query is gated on the
  // session) would otherwise be a dead end with no way off it.
  const header = (
    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
      {/* Back appears only when there IS history to go back to — the design's
          pending frame has an arrow and the confirmed one does not; the
          honest rule behind that difference is "keep back when the screen has
          history". The X always leaves. */}
      <FlowHeader
        title={t.booking.title}
        onBack={router.canGoBack() ? () => router.back() : undefined}
        onClose={leave}
      />
    </SafeAreaView>
  );

  // No session: this is not a failure to load, and it must never look like
  // one. Happens on a deep link into the screen and when the session dies
  // while the screen is open (the refresh failed → clean sign-out).
  // `useBooking` is disabled without a session, and a disabled query in
  // TanStack v5 stays `isPending` forever — so this branch comes FIRST.
  if (authStatus !== "signed-in") {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.stateBody}>
          {authStatus === "loading" ? (
            <LoadingState title={t.booking.bookingLoading} />
          ) : (
            <EmptyState
              title={t.booking.bookingSignedOutTitle}
              description={t.booking.bookingSignedOutDescription}
              action={{
                label: t.booking.bookingSignIn,
                // Comes straight back here after a successful sign-in: this
                // screen stays on the stack underneath the gate.
                onPress: () => router.push("/auth/sign-in"),
                variant: "button",
              }}
            />
          )}
        </View>
      </View>
    );
  }

  if (booking.isPending) {
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
            action={{
              label: t.common.retry,
              onPress: () => void booking.refetch(),
              variant: "button",
            }}
          />
        </View>
      </View>
    );
  }

  const data = booking.data;
  // undefined = we could not find out (the request failed); null = there is
  // none. The dialog says something different for each.
  const paymentValue = payment.isError ? undefined : payment.data;
  const { text: consequence } = describeCancellationCost({ booking: data, payment: paymentValue });
  // Don't offer a decision the guest can't yet make honestly: while the
  // payment check is still running there is no money sentence to show.
  const cancelReady = !canCancel || !payment.isPending;
  // Меню у заведения есть, если деталка принесла хотя бы одно блюдо.
  const hasMenu = (restaurant.data?.menuHighlights.length ?? 0) > 0;
  // Бронь, из которой уже никуда не перейти: визит прошёл, гость не пришёл
  // или бронь отменена. Предзаказывать в неё нечего.
  const terminal = isTerminalBookingStatus(data.status);
  // «Меню» показываем только живой брони с меню у заведения.
  const showMenuAction = hasMenu && !terminal;
  // Бронь, которой уже не будет (отменена, «не пришёл», или время визита
  // прошло, а подтверждения так и не случилось): вместо «На главную» —
  // «Забронировать снова» в то же заведение. Отправлять человека на главную
  // из несостоявшейся брони значит заставить его искать ресторан заново.
  const rebookable = isRebookableBooking(data);

  const onConfirmCancel = () => {
    setCancelError(null);
    cancel.mutate(
      { bookingId: data.id },
      {
        onSuccess: () => setDialogOpen(false),
        onError: (error) => setCancelError(cancelErrorMessage(error)),
      },
    );
  };

  return (
    <View style={styles.root}>
      {header}

      <ScrollView style={styles.scrollFloor}
            contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ReservationHeaderCard
          booking={data}
          restaurant={restaurant.data}
          actions={
            // Ряд из «На главную» и «Меню» (макет 3059:11285, правка владельца
            // 2026-08-20). Отмена отсюда УШЛА вниз, отдельным блоком: держать
            // разрушающее действие рядом с обычной навигацией — приглашение
            // нажать его случайно.
            <View style={styles.actionsRow}>
              <View style={styles.actionCell}>
                {rebookable ? (
                  <PrimaryButton
                    label={t.booking.bookAgain}
                    size="lg"
                    onPress={() =>
                      router.push({
                        pathname: "/restaurant/[id]/book",
                        params: { id: data.restaurantId },
                      })
                    }
                  />
                ) : (
                  <PrimaryButton
                    label={t.booking.backToHome}
                    variant="secondary"
                    size="lg"
                    onPress={() => router.replace("/")}
                  />
                )}
              </View>
              {/* «Меню» ведёт туда же, куда «Выбрать блюда» в блоке предзаказа
                  (правка владельца 2026-08-24: обе кнопки должны делать одно и
                  то же). Раньше верхняя открывала меню на чтение, и человек,
                  выбрав блюда глазами, не понимал, почему они никуда не
                  добавились.

                  Кнопки НЕТ в двух случаях: у заведения нет меню (вела бы на
                  пустой экран) и бронь терминальная — «Не пришли», «Отменена»,
                  «Завершена» (предзаказывать в прошедший визит нечего, и
                  сервер такой предзаказ уже не примет). Когда её нет, «На
                  главную» занимает весь ряд: ячейка `flex: 1` одна и забирает
                  всю ширину, а не висит половинкой у края. */}
              {showMenuAction ? (
                <View style={styles.actionCell}>
                  <PrimaryButton
                    label={t.booking.openMenu}
                    size="lg"
                    onPress={() =>
                      router.push({
                        pathname: "/restaurant/[id]/book/menu",
                        params: { id: data.restaurantId, booking: data.id },
                      })
                    }
                  />
                </View>
              ) : null}
            </View>
          }
        />

        <BookingDetailsCard
          booking={data}
          dateTimeLabel={`${formatRelativeDay(data.startsAt)}, ${formatTime(data.startsAt)}`}
          guestsLabel={t.booking.guestsCount(data.guests)}
          editable={canCancel}
          onEditDateTime={() =>
            router.push({
              pathname: "/booking/[id]/reschedule",
              params: { id: data.id, focus: "date" },
            })
          }
          onEditGuests={() =>
            router.push({
              pathname: "/booking/[id]/reschedule",
              params: { id: data.id, focus: "guests" },
            })
          }
        />

        <WhatHappensNextCard status={data.status} />

        {/* The permission ask, and the only one in the app. Shown just after
            the booking was created, where «сообщим, когда подтвердят» answers
            a question the guest already has — see the reasoning in
            src/lib/push.tsx. The card hides itself on any runtime that cannot
            do push and on any permission that has already been answered. */}
        {created === "1" ? <PushOptInCard /> : null}

        {/* The booking itself succeeded — the table is held. Only attaching the
            pre-order failed (already retried once inside the mutation). There
            is deliberately NO retry button: the flow's draft is gone by this
            point, so a button labelled "повторить" would have nothing to send. */}
        {preorderFailed === "1" ? (
          <BookingCard style={styles.notice}>
            <Text style={styles.noticeText} accessibilityRole="alert">
              {t.booking.preorderSaveFailed}
            </Text>
          </BookingCard>
        ) : null}

        {/* Предзаказ можно собрать И ПОСЛЕ брони (правка владельца 2026-08-24).
            Блок показывается у любой живой брони: пустой — с приглашением
            выбрать блюда, заполненный — со списком и правкой. У отменённой и
            прошедшей брони его нет: менять там нечего. */}
        {cancellable && restaurant.data && (restaurant.data.menuHighlights.length > 0 ||
          (preorder.data?.items.length ?? 0) > 0) ? (
          <BookingCard title={t.booking.preorderSectionTitle}>
            {(preorder.data?.items.length ?? 0) === 0 ? (
              <Text style={styles.preorderHint}>{t.booking.preorderOptional}</Text>
            ) : null}
            <PrimaryButton
              label={
                (preorder.data?.items.length ?? 0) > 0
                  ? t.booking.preorderEdit
                  : t.booking.preorderAdd
              }
              variant="secondary"
              size="lg"
              onPress={() =>
                router.push({
                  pathname: "/restaurant/[id]/book/menu",
                  params: { id: data.restaurantId, booking: data.id },
                })
              }
            />
          </BookingCard>
        ) : null}

        {preorder.data && preorder.data.items.length > 0 ? (
          <BookingCard title={t.booking.preorderSummaryTitle}>
            {preorder.data.items.map((item) => (
              <View key={item.id} style={styles.preorderRow}>
                <Text style={styles.preorderName} numberOfLines={2}>
                  {item.quantity} × {item.name}
                </Text>
                <Text style={styles.preorderPrice}>{formatMoneyMinor(item.totalMinor)}</Text>
              </View>
            ))}
            <View style={styles.preorderRow}>
              <Text style={styles.preorderTotalLabel}>{t.booking.preorderTotalEstimate}</Text>
              <Text style={styles.preorderTotalValue}>
                {formatMoneyMinor(preorder.data.totalMinor)}
              </Text>
            </View>
          </BookingCard>
        ) : null}

        {restaurant.data && hasAnyContact(restaurant.data) ? (
          <ContactsCard restaurant={restaurant.data} />
        ) : null}

        {/* Отмена брони — САМЫЙ ПОСЛЕДНИЙ блок экрана (макет 3073:11402).
            Блок стоит на месте у любой живой брони, даже когда кнопка уже не
            работает: за два часа до визита заведение держит стол, и отмена
            уходит в разговор с рестораном (правило от 18.08.2026). Раньше в
            этом случае блок исчезал целиком, и человек видел экран, где
            отмены просто нет, — это читается как потерянная кнопка, а не как
            правило. Теперь правило написано словами.

            У отменённой и прошедшей брони блока нет вовсе: отменять там
            нечего. */}
        {cancellable ? (
          <BookingCard title={t.booking.cancelSectionTitle}>
            <PrimaryButton
              label={t.booking.cancelBooking}
              variant="secondary"
              size="lg"
              icon={XCircle}
              disabled={!canCancel || !cancelReady || cancel.isPending}
              onPress={() => {
                setCancelError(null);
                setDialogOpen(true);
              }}
            />
            {!canCancel ? (
              <Text style={styles.cancelHint}>{t.booking.cancelWindowClosed}</Text>
            ) : null}
          </BookingCard>
        ) : null}
        {/* Белый хвост под последним блоком. Это отдельный элемент, а не
            нижний отступ контейнера: отступ красился бы серым фоном списка,
            и под последней карточкой снова тянулась бы серая полоса. */}
        <View style={styles.bottomFloor} />
      </ScrollView>

      <CancelBookingDialog
        visible={dialogOpen}
        consequence={consequence}
        pending={cancel.isPending}
        error={cancelError}
        onConfirm={onConfirmCancel}
        onDismiss={() => {
          setCancelError(null);
          setDialogOpen(false);
        }}
      />
    </View>
  );
}

/**
 * The backend's `error` string is English and written for developers, so the
 * message is chosen by HTTP status and never printed. 403 is the venue-only
 * case (a guest may cancel at any time, so in practice it means the booking is
 * not theirs); a 422 that survived the already-cancelled re-read means the
 * booking is in some other terminal state.
 */
function cancelErrorMessage(error: unknown): string {
  if (error instanceof RepositoryError) {
    if (error.status === 403) return t.booking.cancelErrorForbidden;
    if (error.isInvalidStatusTransition || error.isNotFound) return t.booking.cancelErrorGone;
  }
  return t.booking.cancelErrorDescription;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Серый лист, белые карточки — как на главной и карточке заведения.
    backgroundColor: colors.background.screen,
  },
  /** Fills the space under the header so a state view centres in what is left
   * of the screen instead of collapsing under it. */
  stateBody: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  // Белый «пол» ПОД содержимым: он виден только там, где содержимое кончилось —
  // при оттягивании снизу. Сам список блоков красит contentContainer, иначе
  // белое залило бы и просветы между блоками, и разделители исчезли бы.
  //
  // Отрицательный отступ съедает просвет, который контейнер ставит между всеми
  // блоками: последний блок должен переходить в белый «пол» без серой полоски
  // над кнопкой (правка владельца от 20.08).
  bottomFloor: {
    marginTop: -spacing.sm,
    height: spacing.xxl,
    backgroundColor: colors.background.surface,
  },
  scrollFloor: {
    backgroundColor: colors.background.surface,
  },
  content: {
    backgroundColor: colors.background.screen,
    gap: spacing.sm,
  },
  // Две кнопки делят ряд поровну (просвет 12 из макета). Ячейки нужны потому,
  // что PrimaryButton не растягивается сам: без обёртки кнопки схлопнулись бы
  // по ширине подписи, и «Меню» оказалось бы вдвое уже «На главную».
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionCell: {
    flex: 1,
  },
  // Пояснение под неактивной кнопкой отмены.
  cancelHint: {
    ...typography.caption,
    color: colors.text.muted,
  },
  preorderHint: {
    ...typography.body,
    color: colors.text.muted,
  },
  notice: {
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  noticeText: {
    ...typography.body,
    color: colors.text.primary,
  },
  preorderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  preorderName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  preorderPrice: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  preorderTotalLabel: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  preorderTotalValue: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
});
