"use client";

import { usePathname } from "next/navigation";
import type { Booking, BookingStatus, Restaurant } from "@bookeat/api/client";

import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { QrCode } from "@web/components/ui/QrCode";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import { bookingCode, bookingQrPayload } from "@web/lib/booking-code";
import { bookingHref } from "@web/lib/booking-link";
import { isNotFoundError } from "@web/lib/booking-submit";
import { useAuth } from "@web/lib/auth";
import { bookingDateLabel, venueWallClock } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";
import { formatForDisplay, kzNationalDigits } from "@web/lib/phone";
import { useBooking, useVenue } from "@web/lib/queries";
import { loginHref } from "@web/lib/return-to";

/**
 * Страница «Бронь подтверждена» — Figma **QovvuAoI9YxsLMwWkfgKN8**, узел
 * `3525:15019` («WEB / 04b»). Разбор:
 * `/home/tai/work/design-specs/web/spec-booking-confirmed.md`, числа — в
 * `webBookingTicket` (`packages/design-tokens/src/web.ts`).
 *
 * Отдельная страница по адресу брони, а не состояние формы: ссылку можно
 * открыть через неделю, и она покажет бронь В ТОМ СТАТУСЕ, в каком она
 * сейчас. В макете нарисован один сценарий — «заведение подтвердило
 * автоматически», — а сервер создаёт бронь в `pending` и подтверждает сразу
 * только у заведений с `confirm_on_create`. Поэтому заголовок и подпись
 * зависят от статуса, а четвёртая ячейка билета — «Статус», а не «Зона»
 * (зон у сервера нет).
 *
 * ВРЕМЯ — В СТЕННЫХ ЧАСАХ ЗАВЕДЕНИЯ. `Booking.startsAt` приходит в UTC;
 * `venueWallClock` переводит его в зону заведения (`schedule.timezone`), а не
 * в зону браузера — гость, открывший ссылку из другого пояса, должен увидеть
 * то время, на которое его ждут.
 *
 * ЧЕГО В МАКЕТЕ НЕТ: гость без входа, чужая бронь (404), загрузка, отменённая
 * и завершённая бронь. Собрано из примитивов сайта и названо несверенным.
 */
export function BookingResultScreen({ id }: { id: string }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const { signedIn, isLoading: authLoading } = useAuth();
  const booking = useBooking(id);
  const texts = t.web.bookingResult;

  let body: React.ReactNode;
  if (!signedIn && !authLoading) {
    // Ручка `GET /bookings/:id` без сессии отвечает 401: запрос выключен, и
    // вместо вечной загрузки — честная просьба войти с возвратом сюда.
    body = (
      <StateMessage title={texts.signInTitle} text={texts.signInText}>
        <Button size="m" asLink href={loginHref(pathname)}>
          {texts.signInAction}
        </Button>
      </StateMessage>
    );
  } else if (isNotFoundError(booking.error)) {
    body = <StateMessage title={texts.notFoundTitle} text={texts.notFoundText} />;
  } else {
    body = (
      <AsyncBlock
        query={booking}
        emptyText={texts.notFoundText}
        isEmpty={() => false}
        skeleton={<PageSkeleton />}
      >
        {(data) => <Ticket booking={data} />}
      </AsyncBlock>
    );
  }

  return (
    // Кадр 3525:15019 залит `background/subtle`: белый билет стоит на серой
    // подложке, а не сливается с белой страницей.
    <SiteChrome tone="subtle">
      {/* Узел 3525:15021: 72 сверху, 96 снизу, блоки по центру через 32. */}
      <Container className="flex flex-col items-center gap-8 pb-ticket-bottom pt-ticket-top">
        <div className="w-full max-w-ticket">{body}</div>
      </Container>
    </SiteChrome>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex w-full flex-col items-center gap-4">
        <Skeleton className="h-ticket-icon w-ticket-icon rounded-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-[52px] w-full" />
      </div>
      <Skeleton className="h-[550px] w-full rounded-2xl" />
    </div>
  );
}

/** Заголовок и подпись — по статусу брони. Набор статусов — весь
 * `domain.BookingStatus`, потому что ссылку открывают и через неделю. */
type Outcome = "confirmed" | "pending" | "cancelled" | "completed";

const OUTCOME: Record<BookingStatus, Outcome> = {
  confirmed: "confirmed",
  arrived: "confirmed",
  pending: "pending",
  waitlist: "pending",
  cancelled: "cancelled",
  no_show: "cancelled",
  completed: "completed",
};

const STATUS_KEY: Record<BookingStatus, keyof typeof import("@bookeat/i18n").ru.web.bookingResult.status> = {
  pending: "pending",
  waitlist: "waitlist",
  confirmed: "confirmed",
  arrived: "arrived",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "noShow",
};

/** Из этих статусов бронь ещё можно перенести. Остальные либо конечные, либо
 * гость уже за столом. */
const CHANGEABLE: readonly BookingStatus[] = ["pending", "waitlist", "confirmed"];

function Ticket({ booking }: { booking: Booking }) {
  const { t, locale } = useLocale();
  const texts = t.web.bookingResult;
  // Заведение нужно ради зоны, названия, кухни и фотографии. Пока оно едет,
  // билет уже стоит: время считается по запасной зоне и не меняется, когда
  // приедет казахстанское заведение (зона та же).
  const venue = useVenue(booking.restaurantId);
  const wall = venueWallClock(booking.startsAt, venue.data?.schedule?.timezone);
  const dateLong = wall ? bookingDateLabel(wall.date, locale, "dayMonth") ?? "" : "";
  const dateCompact = wall ? bookingDateLabel(wall.date, locale, "weekdayCompact") ?? "" : "";
  const time = wall?.time ?? "";
  const phone = displayPhone(booking.phone);
  const outcome = OUTCOME[booking.status];
  const code = bookingCode(booking.id);

  const heading = {
    confirmed: [texts.confirmedTitle, texts.confirmedText(dateLong, time, phone)],
    pending: [texts.pendingTitle, texts.pendingText(dateLong, time, phone)],
    cancelled: [texts.cancelledTitle, texts.cancelledText],
    completed: [texts.completedTitle, texts.completedText],
  }[outcome];

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Узел 3525:15022: кружок 76, заголовок 40/48, подпись 17/26 через 16. */}
      <div role="status" className="flex flex-col items-center gap-4 text-center">
        <SuccessIcon muted={outcome === "cancelled"} />
        <h1 className="text-h1 tracking-[-0.8px] text-ink">{heading[0]}</h1>
        <p className="text-ticket-lead text-ink-secondary">{heading[1]}</p>
      </div>

      {/* Узел 3525:15028: карточка-билет 720, радиус 24, обводка, тень. */}
      <article className="w-full overflow-hidden rounded-2xl border border-line-strong bg-canvas shadow-card">
        <VenueHeader venue={venue.data} />

        {/* Узел 3525:15032: паддинг 28, блоки через 24. */}
        <div className="flex flex-col gap-6 p-ticket-body">
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-ticket-details">
            <Detail label={texts.details.date} value={dateCompact} />
            <Detail label={texts.details.time} value={time} />
            <Detail label={texts.details.guests} value={t.web.format.guests(booking.guests)} />
            <Detail label={texts.details.status} value={texts.status[STATUS_KEY[booking.status]]} />
          </dl>

          <Divider />

          {/* Узел 3525:15047: QR 96 в рамке радиуса 12, до текста 20. Рамка
              (3525:15048) обведена `border/strong` #DADADA, как и сам билет,
              а не обводкой контрола #B2B2B2: QR — не кнопка и не поле. */}
          <div className="flex items-center gap-5">
            <div className="h-ticket-qr w-ticket-qr shrink-0 rounded-md border border-line-strong bg-canvas p-1.5 text-ink">
              <QrCode value={bookingQrPayload(booking.id)} label={texts.qrLabel} />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-ticket-code-label text-ink-tertiary">{texts.codeLabel}</p>
              <p className="break-all text-ticket-code tracking-[1px] text-ink">{code ?? booking.id}</p>
              <p className="text-bodyS text-ink-secondary">{texts.codeHint}</p>
            </div>
          </div>

          <Divider />

          {/* Узел 3525:15104: две кнопки в ряд через 10, обе 48 высотой. */}
          <div className="grid gap-2.5 md:grid-cols-2">
            {CHANGEABLE.includes(booking.status) ? (
              <Button
                size="ticket"
                variant="outline"
                block
                asLink
                href={bookingHref(booking.restaurantId, {
                  changeBookingId: booking.id,
                  date: wall?.date ?? null,
                  guests: booking.guests,
                })}
              >
                {texts.change}
              </Button>
            ) : null}
            <Button size="submit" block asLink href="/">
              {texts.home}
            </Button>
          </div>
        </div>
      </article>
    </div>
  );
}

/**
 * Шапка билета — узел 3525:15029: 180 высотой, фотография заведения под
 * затемнением, название 28/36 и «кухня · адрес» 14/20 белым, прижаты к низу.
 * Пока заведение едет — серая подложка той же высоты, чтобы билет не прыгал.
 */
function VenueHeader({ venue }: { venue: Restaurant | undefined }) {
  const { t } = useLocale();
  const cuisine = venue?.cuisines[0]?.name.trim() ?? "";
  const address = venue?.address.trim() ?? "";
  const meta = cuisine && address ? t.web.bookingResult.venueMeta(cuisine, address) : cuisine || address;

  return (
    <div className="relative h-ticket-venue overflow-hidden bg-inverse">
      {venue ? (
        <RemoteImage src={venue.coverPhoto?.uri} alt="" sizes="(min-width: 768px) 720px, 100vw" />
      ) : null}
      <div aria-hidden="true" className="absolute inset-0 bg-ticket-scrim" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 px-ticket-venue-x pb-ticket-venue-b text-ink-on-inverse">
        {venue ? (
          <>
            <p className="text-ticket-venue-name tracking-[-0.4px]">{venue.name}</p>
            {meta ? <p className="text-[14px] leading-5">{meta}</p> : null}
          </>
        ) : (
          <Skeleton className="h-9 w-1/2 bg-on-inverse-surface" />
        )}
      </div>
    </div>
  );
}

/** Ячейка 3525:15034: 72 высотой, радиус 14, паддинг 14/16, подпись 12/16
 * Medium с трекингом 0.2, значение 17/24 SemiBold.
 *
 * Значение НЕ обрезается: в макете все четыре значения короткие, а у нас в
 * четвёртой ячейке стоит статус, и «В листе ожидания» в 122 px на 17/600 не
 * помещается. Многоточие спрятало бы именно то слово, ради которого ячейка
 * есть, поэтому ячейка растёт по высоте (`min-h`), а строка переносится. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-ticket-detail flex-col gap-1 rounded-field bg-subtle px-ticket-detail-x py-ticket-detail-y">
      <dt className="text-ticket-detail-label tracking-[0.2px] text-ink-tertiary">{label}</dt>
      <dd className="break-words text-ticket-detail-value text-ink">{value}</dd>
    </div>
  );
}

function Divider() {
  return <hr className="border-0 border-t border-line" />;
}

/** Кружок 76 с галочкой 44 (узлы 3525:15023…15025). Сама галочка обведена
 * `#1B5E20` — это `text/success` (success/700), а не точка «Открыто»
 * (success/500). У отменённой брони галочка неуместна — тот же кружок, но
 * серый и без неё. */
function SuccessIcon({ muted }: { muted: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        muted
          ? "flex h-ticket-icon w-ticket-icon items-center justify-center rounded-full bg-muted"
          : "flex h-ticket-icon w-ticket-icon items-center justify-center rounded-full bg-success text-success-text"
      }
    >
      {muted ? null : (
        <svg
          viewBox="0 0 44 44"
          fill="none"
          focusable="false"
          className="h-ticket-icon-glyph w-ticket-icon-glyph"
        >
          {/* Вектор 22×15.4 по центру клетки 44 (узел 3525:15025). */}
          <path
            d="M11 22.5L18.5 30L33 14.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/** «+7 777 123-45-67» для казахстанского номера; иначе как есть. */
function displayPhone(phone: string): string {
  const digits = kzNationalDigits(phone);
  return digits ? formatForDisplay(digits) : phone;
}
