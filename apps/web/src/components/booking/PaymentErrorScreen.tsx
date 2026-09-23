"use client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { Button } from "@web/components/ui/Button";
import { useLocale } from "@web/lib/locale";

/**
 * «Оплата не прошла» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5390:9217 (веб-кадр).
 * Терминальная (`dead`) фаза `useKaspiPaymentFlow`, но со СВОИМ набором кнопок
 * — см. комментарий в мобильном `payment-error.tsx` про разницу с
 * `paymentDeadTitle`/«Создать новую ссылку» инлайн-карточки.
 */
export function PaymentErrorScreen({ id }: { id: string }) {
  const { t } = useLocale();
  const texts = t.web.bookingResult.paymentScreen;

  return (
    <SiteChrome tone="subtle">
      <Container className="flex flex-col items-center gap-6 pb-ticket-bottom pt-ticket-top">
        <div className="flex w-full max-w-ticket flex-col items-center gap-6 text-center">
          <span className="flex h-ticket-icon w-ticket-icon items-center justify-center rounded-full bg-danger text-danger-text">
            <CrossGlyph />
          </span>
          <h1 className="text-h1 tracking-[-0.8px] text-ink">{texts.failedTitle}</h1>
          <p className="text-ticket-lead text-ink-secondary">{texts.failedText}</p>

          <div className="flex w-full flex-col gap-2.5">
            <Button size="ticket" block asLink href={`/bookings/${id}/payment`}>
              {texts.failedRetry}
            </Button>
            <Button size="ticket" variant="outline" block asLink href={`/bookings/${id}`}>
              {texts.failedBackToBooking}
            </Button>
          </div>
        </div>
      </Container>
    </SiteChrome>
  );
}

function CrossGlyph() {
  return (
    <svg viewBox="0 0 44 44" fill="none" focusable="false" className="h-ticket-icon-glyph w-ticket-icon-glyph">
      <path
        d="M14 14L30 30M30 14L14 30"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
