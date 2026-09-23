import type { Metadata } from "next";

import { PaymentSuccessScreen } from "@web/components/booking/PaymentSuccessScreen";
import { t } from "@web/lib/i18n";

/**
 * «Предзаказ оплачен» — Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5390:8773. Гость
 * попадает сюда через `router.replace` из `/bookings/[id]/payment`, когда
 * платёж перешёл в `captured`.
 */
export const metadata: Metadata = {
  title: t.web.bookingResult.payment.paidTitle,
  robots: { index: false, follow: false },
};

export default async function BookingPaymentSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentSuccessScreen id={id} />;
}
