import { Suspense } from "react";
import type { Metadata } from "next";

import { BookingScreen } from "@web/components/booking/BookingScreen";
import { t } from "@web/lib/i18n";

/**
 * Страница бронирования заведения — Figma QovvuAoI9YxsLMwWkfgKN8, узел
 * 3525:14815. Выбор дня, компании и времени приходит в строке поиска
 * (`lib/booking-link.ts`), поэтому клиентское дерево читает `useSearchParams`
 * и обязано стоять за границей Suspense — иначе Next не может отрисовать
 * страницу заранее и валит сборку.
 */
export const metadata: Metadata = {
  title: `${t.web.header.brand} — ${t.web.booking.title}`,
  // Форма с личными данными поисковику не нужна.
  robots: { index: false, follow: false },
};

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <BookingScreen id={id} />
    </Suspense>
  );
}
