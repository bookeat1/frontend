"use client";

import { Button } from "@web/components/ui/Button";
import { formatMoneyMinor } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";

/**
 * Точка входа в полноэкранную оплату предзаказа (Figma qmMsg4jO1ggmyEHNIAD2ll,
 * узел 5390:8967) с билета — веб-версия mobile
 * `PreorderPaymentEntryCard.tsx`. Сама оплата (счёт, отсчёт, «я оплатил»)
 * рисуется на `/bookings/[id]/payment`, этот блок только ведёт туда.
 */
export function PreorderPaymentEntryCard({
  amountMinor,
  href,
}: {
  amountMinor: number | null;
  href: string;
}) {
  const { t } = useLocale();
  const texts = t.web.bookingResult.payment;
  const amount = amountMinor === null ? null : formatMoneyMinor(amountMinor);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-subtle p-4">
      <p className="text-bodyS font-semibold tracking-[0.2px] text-ink-tertiary">{texts.sectionTitle}</p>
      <p className="text-bodyS text-ink-secondary">{texts.intro}</p>
      <Button size="ticket" block asLink href={href}>
        {amount ? t.web.bookingResult.paymentScreen.entryCta(amount) : texts.payWithKaspi}
      </Button>
    </div>
  );
}
