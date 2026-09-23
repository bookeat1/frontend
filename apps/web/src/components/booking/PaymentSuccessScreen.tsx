"use client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { formatMoneyMinor } from "@web/lib/format";
import { useAuth } from "@web/lib/auth";
import { useLocale } from "@web/lib/locale";
import { usePreorder } from "@web/lib/queries";
import { loginHref } from "@web/lib/return-to";

/**
 * «Предзаказ оплачен» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5390:8773 (веб-кадр).
 * Приходит сюда ТОЛЬКО из `PaymentScreen` через `router.replace`, когда
 * `useKaspiPaymentFlow` сообщил `phase === "paid"`.
 *
 * НЕСОВПАДЕНИЕ С МАКЕТОМ: строки блюд там с фотографией — `PreorderLine` с
 * сервера фото не отдаёт, строки текстовые, как на билете брони.
 */
export function PaymentSuccessScreen({ id }: { id: string }) {
  const { t } = useLocale();
  const { signedIn, isLoading: authLoading } = useAuth();
  const preorder = usePreorder(id);
  const texts = t.web.bookingResult.paymentScreen;

  if (!signedIn && !authLoading) {
    return (
      <Shell>
        <StateMessage title={t.web.bookingResult.signInTitle} text={t.web.bookingResult.signInText}>
          <Button size="m" asLink href={loginHref(`/bookings/${id}/payment/success`)}>
            {t.web.bookingResult.signInAction}
          </Button>
        </StateMessage>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-ticket-icon w-ticket-icon items-center justify-center rounded-full bg-success text-success-text">
          <CheckGlyph />
        </span>
        <h1 className="text-h1 tracking-[-0.8px] text-ink">{t.web.bookingResult.payment.paidTitle}</h1>
        <p className="text-ticket-lead text-ink-secondary">{texts.successSubtitle}</p>
      </div>

      <AsyncBlock
        query={preorder}
        emptyText=""
        isEmpty={(data) => data.items.length === 0}
        empty={null}
        skeleton={<Skeleton className="h-[160px] w-full rounded-xl" />}
      >
        {(data) => (
          <ul className="flex w-full flex-col gap-2">
            {data.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-subtle p-4 text-bodyM text-ink"
              >
                <span className="min-w-0 truncate">
                  {item.quantity} × {item.name}
                </span>
                <span>{formatMoneyMinor(item.totalMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </AsyncBlock>

      <Button size="ticket" block asLink href={`/bookings/${id}`}>
        {texts.successAction}
      </Button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SiteChrome tone="subtle">
      <Container className="flex flex-col items-center gap-6 pb-ticket-bottom pt-ticket-top">
        <div className="flex w-full max-w-ticket flex-col items-center gap-6">{children}</div>
      </Container>
    </SiteChrome>
  );
}

/** Тот же вектор 22×15.4, что у `SuccessIcon` на билете брони (узел
 * 3525:15025) — экран «успешной оплаты» переиспользует эту же роль. */
function CheckGlyph() {
  return (
    <svg viewBox="0 0 44 44" fill="none" focusable="false" className="h-ticket-icon-glyph w-ticket-icon-glyph">
      <path
        d="M11 22.5L18.5 30L33 14.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
