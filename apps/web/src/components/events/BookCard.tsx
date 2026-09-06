"use client";

import { useState } from "react";

import { Button } from "@web/components/ui/Button";
import { GuestsField } from "@web/components/venue/BookingFields";
import { bookingHref } from "@web/lib/booking-link";
import { DEFAULT_GUESTS } from "@web/lib/booking-options";
import { useT } from "@web/lib/locale";

/**
 * Правая карточка «Записаться» (событие) / «Забронировать столик» (акция) —
 * узел 5033:6922. Оболочка — ТА ЖЕ, что у `BookingCard` заведения
 * (`webVenuePage.asideCard`: радиус 20, паддинг 24, просвет 24, обводка
 * `border-line-strong`, `shadow-aside`), числа не повторяются вторым набором.
 *
 * Слота здесь нет вовсе — «слот сверяется с живой доступностью на странице
 * брони» (T1, правило владельца): карточка только собирает дату (для
 * события, только чтение) и число гостей, а бронь оформляется на
 * `/venues/:id/book`.
 */
export function BookCard({
  title,
  subtitle,
  restaurantId,
  date,
  dateField,
  footNote,
}: {
  title: string;
  subtitle?: string | null;
  restaurantId: string;
  /** «YYYY-MM-DD» дня события — предзаполняет дату на странице брони, чтобы
   * гость не попал на бронь с сегодняшней датой по умолчанию. Битую строку
   * молча отфильтрует сам `bookingHref` (`DATE_RE`). */
  date?: string | null;
  /** Дата события, только для чтения — акции предзаполнять нечем, поле
   * тогда не передаётся вовсе (не «пустое поле», а его отсутствие). */
  dateField?: { shown: string | null } | null;
  /** «{capacity} мест» под кнопкой — только когда известна вместимость. */
  footNote?: string | null;
}) {
  const t = useT();
  const [guests, setGuests] = useState(DEFAULT_GUESTS);

  return (
    <div className="flex w-full shrink-0 flex-col gap-6 overflow-hidden rounded-xl border border-line-strong bg-canvas p-6 shadow-aside lg:sticky lg:top-6 lg:w-venue-aside">
      <header className="flex flex-col gap-1">
        <h2 className="text-[21px] font-bold leading-7 tracking-[-0.2px] text-ink">{title}</h2>
        {subtitle ? <p className="text-[14px] leading-5 text-ink-secondary">{subtitle}</p> : null}
      </header>

      <div className="flex flex-col gap-3 md:flex-row">
        {dateField ? (
          <ReadOnlyDateField label={t.web.venue.booking.dateLabel} shown={dateField.shown} />
        ) : null}
        <GuestsField
          id="afisha-book-guests"
          label={t.web.venue.booking.guestsLabel}
          value={guests}
          disabled={false}
          onChange={setGuests}
        />
      </div>

      <Button
        asLink
        href={bookingHref(restaurantId, { guests, date: date ?? null })}
        block
        className="h-afisha-book rounded-field"
      >
        {title}
      </Button>
      {footNote ? <p className="text-center text-[12px] leading-4 text-ink-tertiary">{footNote}</p> : null}
    </div>
  );
}

/** Дата, предзаполненная из `starts_at`, только чтение — гость её не меняет
 * ни в календаре, ни в тексте. Отдельная от `DateField`: та рисует настоящий
 * `input[type=date]`, здесь он не нужен вовсе, только визуальный факт. */
function ReadOnlyDateField({ label, shown }: { label: string; shown: string | null }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-booking-label text-ink-secondary">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-line-control bg-canvas px-booking-field-x py-booking-field-y">
        <span className="min-w-0 flex-1 truncate text-booking-value text-ink">{shown ?? ""}</span>
      </div>
    </div>
  );
}
