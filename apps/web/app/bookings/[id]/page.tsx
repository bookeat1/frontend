import type { Metadata } from "next";

import { BookingResultScreen } from "@web/components/booking/BookingResultScreen";
import { t } from "@web/lib/i18n";

/**
 * Бронь гостя — Figma QovvuAoI9YxsLMwWkfgKN8, узел 3525:15019 («Бронь
 * подтверждена»). Идентификатор — UUID брони; чужую или несуществующую
 * сервер отдаёт 404, и экран говорит об этом словами.
 */
export const metadata: Metadata = {
  title: t.web.bookingResult.metaTitle,
  // Личная страница, поисковику нечего здесь индексировать.
  robots: { index: false, follow: false },
};

export default async function BookingResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingResultScreen id={id} />;
}
