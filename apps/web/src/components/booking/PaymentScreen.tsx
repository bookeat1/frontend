"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RepositoryError, isCancellableBookingStatus, type Booking } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { formatCountdown, preorderPaymentGate, remainingMs } from "@web/lib/kaspi-payment";
import { formatMoneyMinor } from "@web/lib/format";
import { useAuth } from "@web/lib/auth";
import { isNotFoundError } from "@web/lib/booking-submit";
import { useLocale } from "@web/lib/locale";
import { useBooking, useBookingPayment, usePreorder, useVenue } from "@web/lib/queries";
import { loginHref } from "@web/lib/return-to";
import { useKaspiPaymentFlow } from "@web/lib/use-kaspi-payment";

/**
 * Полноэкранная оплата предзаказа — Figma qmMsg4jO1ggmyEHNIAD2ll, узел
 * 5390:8967 («Payment», веб-кадр без нативной шапки: в макете это модальная
 * шторка над «Бронь подтверждена», здесь — отдельная страница
 * `/bookings/[id]/payment`, как просит задача).
 *
 * НЕСОВПАДЕНИЯ С МАКЕТОМ, зафиксированные намеренно:
 *  - строка «Способ оплаты» в узле — выбор сохранённой карты («Карта ••••
 *    4242», «Изменить»). В бэкенде сохранённых карт нет — есть только Kaspi
 *    Pay (редирект на pay.kaspi.kz), поэтому строка нередактируема;
 *  - строки предзаказа в макете — с фотографией; `PreorderLine` фото не
 *    отдаёт (`packages/api/src/types.ts`), строки текстовые, как на билете.
 */
export function PaymentScreen({ id }: { id: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const { signedIn, isLoading: authLoading } = useAuth();
  const booking = useBooking(id);

  if (!signedIn && !authLoading) {
    return (
      <Shell>
        <StateMessage title={t.web.bookingResult.signInTitle} text={t.web.bookingResult.signInText}>
          <Button size="m" asLink href={loginHref(`/bookings/${id}/payment`)}>
            {t.web.bookingResult.signInAction}
          </Button>
        </StateMessage>
      </Shell>
    );
  }

  if (isNotFoundError(booking.error)) {
    return (
      <Shell>
        <StateMessage title={t.web.bookingResult.notFoundTitle} text={t.web.bookingResult.notFoundText} />
      </Shell>
    );
  }

  return (
    <Shell>
      <AsyncBlock
        query={booking}
        emptyText={t.web.bookingResult.notFoundText}
        isEmpty={() => false}
        skeleton={<Skeleton className="h-[480px] w-full rounded-2xl" />}
      >
        {(data) => <PaymentBody booking={data} router={router} />}
      </AsyncBlock>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SiteChrome tone="subtle">
      <Container className="flex flex-col items-center gap-8 pb-ticket-bottom pt-ticket-top">
        <div className="w-full max-w-ticket">{children}</div>
      </Container>
    </SiteChrome>
  );
}

function PaymentBody({
  booking,
  router,
}: {
  booking: Booking;
  router: ReturnType<typeof useRouter>;
}) {
  const bookingId = booking.id;
  const { t } = useLocale();
  const texts = t.web.bookingResult.paymentScreen;
  const venue = useVenue(booking.restaurantId);
  const preorder = usePreorder(bookingId);
  const bookingPayment = useBookingPayment(bookingId);

  const paymentGate = preorderPaymentGate({
    bookingIsLive: isCancellableBookingStatus(booking.status),
    preorderItemsCount: preorder.data?.items.length ?? 0,
    venueAcceptsOnlinePayment: venue.data?.acceptsOnlinePayment === true,
    existingPayment: bookingPayment.isError ? null : bookingPayment.data,
  });
  const paymentFlow = useKaspiPaymentFlow({
    bookingId,
    existing: bookingPayment.isError ? null : bookingPayment.data,
    enabled: true,
  });

  // Платёж решён — страница оплаты больше не нужна. `replace`, чтобы «назад»
  // с развязки не возвращал на уже решённый счёт.
  const phase = paymentFlow.phase;
  useEffect(() => {
    if (phase === "paid") router.replace(`/bookings/${bookingId}/payment/success`);
    else if (phase === "dead") router.replace(`/bookings/${bookingId}/payment/error`);
  }, [phase, router, bookingId]);

  if (!paymentGate.payable && phase !== "settling") {
    return (
      <StateMessage text={t.web.bookingResult.payment.errorUnavailable}>
        <Button size="ticket" asLink href={`/bookings/${bookingId}`}>
          {texts.failedBackToBooking}
        </Button>
      </StateMessage>
    );
  }

  const amountMinor = paymentFlow.payment?.amountMinor ?? preorder.data?.totalMinor ?? null;
  const amount = amountMinor === null ? null : formatMoneyMinor(amountMinor);
  const left = remainingMs(paymentFlow.payment?.expiresAt ?? null, paymentFlow.now);
  const failure = createFailureMessage(paymentFlow.error, t.web.bookingResult.payment);

  return (
    <article className="flex w-full flex-col gap-6 rounded-2xl border border-line-strong bg-canvas p-ticket-body shadow-card">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 tracking-[-0.8px] text-ink">{t.web.bookingResult.payment.sectionTitle}</h1>
        {venue.data ? <p className="text-bodyM text-ink-secondary">{venue.data.name}</p> : null}
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-subtle p-3">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand px-4 py-3">
          <p className="text-bodyM text-ink-on-brand">{t.web.bookingResult.preorder.title}</p>
          {amount ? <p className="text-bodyM font-semibold text-ink-on-brand">{amount}</p> : null}
        </div>
        <ul className="flex flex-col gap-2">
          {(preorder.data?.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-bodyM text-ink">
              <span className="min-w-0 truncate">
                {item.quantity} × {item.name}
              </span>
              <span>{formatMoneyMinor(item.totalMinor)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl bg-subtle p-4">
        <p className="text-bodyS text-ink-tertiary">{texts.methodLabel}</p>
        <p className="text-bodyM font-medium text-ink">{texts.methodValue}</p>
      </div>

      <p className="text-bodyS text-ink-tertiary">{texts.checkoutNote}</p>

      {phase === "settling" ? (
        <p role="status" className="text-bodyM font-semibold text-ink">
          {t.web.bookingResult.payment.settlingTitle}
        </p>
      ) : null}

      {phase === "awaiting" ? (
        <div className="flex flex-col gap-3">
          <p className="text-bodyM font-semibold text-ink">{t.web.bookingResult.payment.awaitingTitle}</p>
          {left !== null ? (
            <p role="status" className="text-bodyS text-ink-secondary">
              {t.web.bookingResult.payment.countdown(formatCountdown(left))}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="ticket"
              variant="outline"
              block
              disabled={!paymentFlow.openLink}
              onClick={() => {
                if (paymentFlow.openLink) window.location.assign(paymentFlow.openLink);
              }}
            >
              {t.web.bookingResult.payment.openAgain}
            </Button>
            <Button size="ticket" variant="secondary" block onClick={paymentFlow.check}>
              {t.web.bookingResult.payment.checkAgain}
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "idle" ? (
        <Button
          size="ticket"
          block
          loading={paymentFlow.creating}
          disabled={paymentFlow.creating}
          onClick={paymentFlow.pay}
        >
          {amount
            ? t.web.bookingResult.payment.payWithKaspiAmount(amount)
            : t.web.bookingResult.payment.payWithKaspi}
        </Button>
      ) : null}

      {failure ? (
        <p role="alert" className="text-bodyS text-danger-text">
          {failure}
        </p>
      ) : null}
    </article>
  );
}

function createFailureMessage(
  error: unknown,
  texts: { errorOffline: string; errorAlreadyActive: string; errorUnavailable: string; errorServer: string },
): string | null {
  if (!error) return null;
  if (error instanceof RepositoryError) {
    if (error.isOffline) return texts.errorOffline;
    if (error.status === 409) return texts.errorAlreadyActive;
    if (error.status === 422) return texts.errorUnavailable;
  }
  return texts.errorServer;
}
