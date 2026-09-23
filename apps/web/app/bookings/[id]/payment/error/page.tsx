import type { Metadata } from "next";

import { PaymentErrorScreen } from "@web/components/booking/PaymentErrorScreen";
import { t } from "@web/lib/i18n";

/**
 * «Оплата не прошла» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5390:9217. Гость
 * попадает сюда через `router.replace` из `/bookings/[id]/payment`, когда
 * ссылка на оплату умерла (истекла/отклонена).
 */
export const metadata: Metadata = {
  title: t.web.bookingResult.paymentScreen.failedTitle,
  robots: { index: false, follow: false },
};

export default async function BookingPaymentErrorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentErrorScreen id={id} />;
}
