import type { Metadata } from "next";

import { PaymentScreen } from "@web/components/booking/PaymentScreen";
import { t } from "@web/lib/i18n";

/**
 * Полноэкранная оплата предзаказа — Figma qmMsg4jO1ggmyEHNIAD2ll, узел
 * 5390:8967. См. `PaymentScreen` для деталей и несовпадений с макетом.
 */
export const metadata: Metadata = {
  title: t.web.bookingResult.payment.sectionTitle,
  robots: { index: false, follow: false },
};

export default async function BookingPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentScreen id={id} />;
}
