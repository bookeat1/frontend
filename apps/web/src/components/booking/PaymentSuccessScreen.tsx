"use client";

import { useMemo } from "react";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { formatMoneyMinor } from "@web/lib/format";
import { useAuth } from "@web/lib/auth";
import { useLocale } from "@web/lib/locale";
import { useBooking, useMenuSections, usePreorder } from "@web/lib/queries";
import { loginHref } from "@web/lib/return-to";

/**
 * «Предзаказ оплачен» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5390:8773 (веб-кадр).
 * Приходит сюда ТОЛЬКО из `PaymentScreen` через `router.replace`, когда
 * `useKaspiPaymentFlow` сообщил `phase === "paid"`.
 *
 * Строки блюд — как в макете 5390:8698: название, описание (2 строки) и
 * цена слева, фото с бейджем количества справа. `PreorderLine` фото и
 * описания не отдаёт — берём из меню заведения по `menuItemId`; пока меню не
 * приехало или упало, строка рисуется без описания и с серой плашкой.
 */
export function PaymentSuccessScreen({ id }: { id: string }) {
  const { t } = useLocale();
  const { signedIn, isLoading: authLoading } = useAuth();
  const preorder = usePreorder(id);
  const booking = useBooking(id);
  const menu = useMenuSections(booking.data?.restaurantId ?? "", { enabled: Boolean(booking.data) });
  const dishById = useMemo(() => {
    const map = new Map<string, { description: string; imageUrl: string | null }>();
    for (const section of menu.data ?? []) {
      for (const dish of section.dishes) map.set(dish.id, { description: dish.description, imageUrl: dish.imageUrl });
    }
    return map;
  }, [menu.data]);
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
          <ul className="flex w-full flex-col gap-4 text-left">
            {data.items.map((item) => {
              const dish = item.menuItemId ? dishById.get(item.menuItemId) : undefined;
              const description = dish?.description.trim();
              return (
                <li key={item.id} className="flex items-start gap-3 text-ink">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="break-words text-bodyM font-semibold">{item.name}</span>
                    {description ? (
                      <span className="line-clamp-2 break-words text-bodyS text-ink-tertiary">{description}</span>
                    ) : null}
                    <span className="text-bodyM">{formatMoneyMinor(item.totalMinor)}</span>
                  </div>
                  <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-muted">
                    <RemoteImage src={dish?.imageUrl} alt="" sizes="72px" />
                    <span
                      aria-label={`× ${item.quantity}`}
                      className="absolute bottom-1 right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/55 px-1 text-bodyS text-white"
                    >
                      {item.quantity}
                    </span>
                  </div>
                </li>
              );
            })}
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
