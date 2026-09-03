"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Restaurant } from "@bookeat/api/client";

import {
  ContactsCard,
  PartyCard,
  WhenCard,
  WishesCard,
  type ContactsErrors,
  type ContactsValue,
  type WishKey,
} from "@web/components/booking/BookingCards";
import { BookingSummary, type SummaryAction, type SummaryRow } from "@web/components/booking/BookingSummary";
import { Container } from "@web/components/layout/Container";
import { SiteChrome } from "@web/components/layout/SiteChrome";
import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { useAuth } from "@web/lib/auth";
import { clearBookingDraft } from "@web/lib/booking-draft";
import {
  clearBookingFormDraft,
  readBookingFormDraft,
  writeBookingFormDraft,
} from "@web/lib/booking-form-draft";
import { bookingHref, bookingResultPath, readBookingIntent, type BookingIntent } from "@web/lib/booking-link";
import {
  describeBookingFailure,
  isNotFoundError,
  looksLikeEmail,
  newIdempotencyKey,
  type SubmitFailure,
} from "@web/lib/booking-submit";
import { bookingDateLabel, slotDateIso, slotTimeLabel, todayIso } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";
import { isComplete, nationalDigits, toE164 } from "@web/lib/phone";
import { useAvailability, useCreateBooking, useRescheduleBooking, useVenue } from "@web/lib/queries";
import { loginHref } from "@web/lib/return-to";

/**
 * Страница бронирования — Figma **QovvuAoI9YxsLMwWkfgKN8**, узел `3525:14815`
 * («WEB / 04 · Бронирование»). Разбор узла:
 * `/home/tai/work/design-specs/web/spec-booking-flow.md`, числа — в
 * `webBookingFlow` (`packages/design-tokens/src/web.ts`).
 *
 * ОДИН ЭКРАН, А НЕ МАСТЕР: так в макете. Слева четыре карточки (дата и время,
 * гости, контакты, пожелания), справа сводка с кнопкой. Выбор дня, компании и
 * времени приходит В АДРЕСЕ с карточки заведения (`lib/booking-link.ts`) и
 * пишется обратно в адрес при каждой правке — поэтому уход на вход и возврат
 * по `?next=` ничего не теряют, а ссылку можно переслать.
 *
 * ЗАЧЕМ ЗДЕСЬ ПОЛЯ ИМЕНИ И ТЕЛЕФОНА, если гость вошёл. Сервер требует непустое
 * `name` (usecase/bookings/create.go: `name required`), а вход по коду
 * создаёт учётную запись БЕЗ имени. Пока бронь оформлялась «на имя из
 * профиля», гость с пустым именем упирался в тупик «заполните имя в
 * приложении». Теперь имя и телефон — поля формы (узлы 3525:14905 и
 * 3525:14909), подставленные из профиля, но редактируемые: как и нарисовано
 * («Камила» в макете набрана цветом значения, а не плейсхолдера).
 *
 * ЧЕГО В МАКЕТЕ НЕТ (собрано из примитивов сайта, перечислено несверенным):
 * выбор даты, загрузка и сбой, четыре пустоты выдачи, ошибки полей, гость без
 * входа, отказы сервера, режим переноса, «заведение не принимает брони».
 *
 * ЧТО НАРИСОВАНО, НО НЕ СДЕЛАНО: зоны посадки (сервер их не отдаёт и не
 * принимает), плашка и кнопка предзаказа (предзаказа на сайте нет).
 */
export function BookingScreen({ id }: { id: string }) {
  const { t } = useLocale();
  const params = useSearchParams();
  const intent = useMemo(() => readBookingIntent(params), [params]);
  const venue = useVenue(id);

  return (
    <SiteChrome active="venues">
      {/* Узел 3525:14817: 32 сверху, 80 снизу. */}
      <Container className="pb-20 pt-8">
        <div className="flex flex-col gap-6">
          <nav aria-label={t.web.venue.breadcrumbLabel} className="text-[13px] leading-[18px] text-ink-tertiary">
            <Link
              href={`/venues/${encodeURIComponent(id)}`}
              className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              ← {t.web.booking.backToVenue}
            </Link>
          </nav>

          {isNotFoundError(venue.error) ? (
            <StateMessage title={t.web.venue.notFound.title} text={t.web.venue.notFound.text}>
              <Link
                href="/venues"
                className="text-[16px] font-semibold leading-6 text-brand-text underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t.web.venue.notFound.back}
              </Link>
            </StateMessage>
          ) : (
            <AsyncBlock
              query={venue}
              emptyText={t.web.venue.notFound.text}
              isEmpty={() => false}
              skeleton={<PageSkeleton />}
            >
              {(data) => <BookingForm key={data.id} venue={data} intent={intent} />}
            </AsyncBlock>
          )}
        </div>
      </Container>
    </SiteChrome>
  );
}

/** Две колонки той же ширины, что у живой страницы: 788 + 32 + 380. */
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Skeleton className="h-[398px] w-full rounded-2xl" />
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <Skeleton className="h-[326px] w-full rounded-2xl" />
      </div>
      <div className="w-full lg:w-venue-aside lg:shrink-0">
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </div>
    </div>
  );
}

const EMPTY_CONTACTS: ContactsValue = { name: "", phoneDigits: "", email: "", offer: true };

function BookingForm({ venue, intent }: { venue: Restaurant; intent: BookingIntent }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const { signedIn, isLoading: authLoading, user } = useAuth();

  /**
   * Дата появляется ПОСЛЕ гидратации: «сегодня» знает только браузер, и
   * посчитанное в разметке значение разошлось бы с браузерным. До этого
   * момента запрос доступности выключен.
   */
  const [today, setToday] = useState<string | null>(null);
  /** `null` — до гидратации, `""` — гость очистил поле. */
  const [date, setDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(intent.guests);
  const [slot, setSlot] = useState<string | null>(intent.slot);

  const [contacts, setContacts] = useState<ContactsValue>(EMPTY_CONTACTS);
  const [notes, setNotes] = useState("");
  const [wishes, setWishes] = useState<ReadonlySet<WishKey>>(() => new Set());
  /** Поля, ошибку которых пора показывать: тронутые и все — после попытки. */
  const [touched, setTouched] = useState<Set<"name" | "phone" | "email">>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  /** Номер неудачной попытки отправки: по нему фокус уходит в первое поле с
   * ошибкой (см. эффект ниже). Счётчик, а не флаг: вторая попытка с той же
   * ошибкой обязана снова увести фокус. */
  const [failedAttempt, setFailedAttempt] = useState(0);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const rescheduleId = intent.changeBookingId;

  useEffect(() => {
    const iso = todayIso();
    setToday(iso);
    // Дата из адреса, если она не в прошлом; иначе сегодня.
    setDate((current) => current ?? (intent.date && intent.date >= iso ? intent.date : iso));
    // Контакты, набранные до ухода на вход, возвращаются на место.
    const draft = readBookingFormDraft(venue.id);
    if (draft) {
      setContacts((current) => ({
        ...current,
        name: draft.name,
        phoneDigits: draft.phoneDigits,
        email: draft.email,
      }));
      setNotes(draft.notes);
      setWishes(new Set(draft.wishes.filter(isWishKey)));
    }
    // Адрес читается ОДИН раз, при монтировании: дальше он ведомый, а не
    // ведущий (см. эффект записи ниже).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id]);

  /**
   * Профиль подставляется в ПУСТЫЕ поля, и только в них: набранное гостем (в
   * том числе черновик) дороже того, что лежит в профиле. Функциональные
   * обновления, а не чтение `contacts` из замыкания: эффект черновика выше
   * ставит значения в том же коммите, и замыкание их ещё не видит.
   */
  useEffect(() => {
    if (!user) return;
    const profileName = user.fullName.trim();
    const profileDigits = user.phone ? nationalDigits(user.phone) : "";
    setContacts((current) => ({
      ...current,
      name: current.name || profileName,
      phoneDigits: current.phoneDigits || profileDigits,
      email: current.email || user.email.trim(),
    }));
  }, [user]);

  /**
   * Ошибка формы ДОЛЖНА быть под рукой, а не только на экране. Кнопка стоит в
   * правой колонке, поля — в левой; на 1440 они рядом, но гость, нажавший
   * «Забронировать» с пустым именем, всё равно смотрит на кнопку. Фокус в
   * первом невалидном поле — это и прокрутка к нему, и объявление ошибки
   * диктору через `aria-describedby`. Эффект, а не вызов из `submit`: ошибки
   * появляются в разметке только после коммита с `attempted`.
   */
  useEffect(() => {
    if (failedAttempt === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [failedAttempt]);

  useEffect(() => {
    if (today === null) return;
    writeBookingFormDraft(venue.id, {
      name: contacts.name,
      phoneDigits: contacts.phoneDigits,
      email: contacts.email,
      notes,
      wishes: Array.from(wishes),
    });
  }, [venue.id, today, contacts, notes, wishes]);

  /**
   * Выбор → адрес. `replace`, а не `push`: каждая правка гостей не должна
   * становиться шагом истории, иначе «назад» листает собственные клики.
   */
  const currentHref = bookingHref(venue.id, {
    date: date || null,
    guests,
    slot,
    changeBookingId: rescheduleId,
  });
  const writtenHref = useRef<string | null>(null);
  useEffect(() => {
    if (today === null || date === null) return;
    if (writtenHref.current === currentHref) return;
    writtenHref.current = currentHref;
    router.replace(currentHref, { scroll: false });
  }, [today, date, currentHref, router]);

  const availability = useAvailability({
    restaurantId: venue.id,
    date,
    guests,
    acceptsOnlineBookings: venue.acceptsOnlineBookings,
  });
  const create = useCreateBooking();
  const reschedule = useRescheduleBooking();
  const submitting = create.isPending || reschedule.isPending;

  const slots = availability.data?.slots;
  const chosen = slots?.find((item) => item.startsAt === slot && item.available) ?? null;

  /**
   * Ключ идемпотентности живёт ровно столько, сколько живёт ВЫБОР. Тот же ключ
   * на повтор той же брони — второе нажатие и повтор после обрыва не дают
   * второй стол; новый выбор — новый ключ. Ссылка, а не `useMemo`: `useMemo`
   * React вправе сбросить когда угодно.
   */
  const selection = `${venue.id}|${date}|${guests}|${slot}`;
  const idempotency = useRef<{ selection: string; key: string } | null>(null);
  if (idempotency.current?.selection !== selection) {
    idempotency.current = { selection, key: newIdempotencyKey() };
  }
  const idempotencyKey = idempotency.current.key;

  /** Пока бронь летит, выбор ЗАМОРОЖЕН: и в разметке, и здесь. `reset()`
   * мутации не зовётся нигде — в TanStack v5 он отписывает наблюдателя, и
   * `onSuccess` не приходит (см. правила после ревью PR #115). */
  function pickDate(next: string) {
    if (submitting) return;
    setDate(next);
    setSlot(null);
    setFailure(null);
  }

  function pickGuests(next: number) {
    if (submitting) return;
    setGuests(next);
    setSlot(null);
    setFailure(null);
  }

  function pickSlot(next: string) {
    if (submitting) return;
    setSlot(next);
    setFailure(null);
  }

  function toggleWish(key: WishKey) {
    if (submitting) return;
    setWishes((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Все ошибки формы. Что из них ПОКАЗЫВАТЬ — решает `visibleErrors`. */
  const errors: ContactsErrors = {
    name: contacts.name.trim() ? undefined : t.web.booking.contacts.errors.name,
    phone: isComplete(contacts.phoneDigits) ? undefined : t.web.booking.contacts.errors.phone,
    email:
      contacts.email.trim() && !looksLikeEmail(contacts.email)
        ? t.web.booking.contacts.errors.email
        : undefined,
    offer: contacts.offer ? undefined : t.web.booking.contacts.errors.offer,
  };
  const formValid = !errors.name && !errors.phone && !errors.email && !errors.offer;
  const visibleErrors: ContactsErrors = {
    name: attempted || touched.has("name") ? errors.name : undefined,
    phone: attempted || touched.has("phone") ? errors.phone : undefined,
    email: attempted || touched.has("email") ? errors.email : undefined,
    offer: attempted ? errors.offer : undefined,
  };

  /** Что уходит в `notes`: выбранные чипы, потом свободный текст. Чип без
   * этого был бы украшением — сервер принимает только текст. */
  const composedNotes = composeNotes(
    Array.from(wishes).map((key) => t.web.booking.wishes.quick[key]),
    notes,
  );

  function onSuccess(bookingId: string) {
    clearBookingFormDraft(venue.id);
    clearBookingDraft(venue.id);
    router.push(bookingResultPath(bookingId));
  }

  function submit() {
    if (!chosen || submitting || !signedIn) return;
    if (rescheduleId) {
      setFailure(null);
      reschedule.mutate(
        { bookingId: rescheduleId, input: { startsAt: chosen.startsAt, guests } },
        {
          onSuccess: (booking) => onSuccess(booking.id),
          onError: (error) => setFailure(describeBookingFailure(error, t, () => setSlot(null))),
        },
      );
      return;
    }
    setAttempted(true);
    if (!formValid) {
      setFailure({ title: t.web.booking.errors.formTitle, text: t.web.booking.errors.formText });
      setFailedAttempt((count) => count + 1);
      return;
    }
    setFailure(null);
    create.mutate(
      {
        input: {
          restaurantId: venue.id,
          // Ровно та строка, что пришла в слоте: собственный разбор времени
          // здесь означал бы перевод в другой пояс.
          startsAt: chosen.startsAt,
          guests,
          name: contacts.name.trim(),
          phone: toE164(contacts.phoneDigits),
          email: contacts.email.trim() || undefined,
          notes: composedNotes || undefined,
        },
        idempotencyKey,
      },
      {
        onSuccess: (booking) => onSuccess(booking.id),
        onError: (error) => setFailure(describeBookingFailure(error, t, () => setSlot(null))),
      },
    );
  }

  /** Сводка считает день ОТ СЛОТА: заведение до 02:00 отдаёт старты
   * следующего числа, и «25 августа · 00:30» отправило бы гостя не в ту ночь. */
  const summaryDate = chosen ? slotDateIso(chosen.startsAt) : date || null;
  const rows: SummaryRow[] = [
    {
      label: t.web.booking.summary.dateLabel,
      value: summaryDate ? bookingDateLabel(summaryDate, locale, "weekdayShort") : null,
    },
    { label: t.web.booking.summary.timeLabel, value: chosen ? slotTimeLabel(chosen.startsAt) : null },
    { label: t.web.booking.summary.guestsLabel, value: t.web.format.guests(guests) },
    ...(rescheduleId
      ? []
      : [{ label: t.web.booking.summary.wishesLabel, value: composedNotes || null }]),
  ];

  let action: SummaryAction;
  if (!signedIn && !authLoading) {
    action = { kind: "signIn", href: loginHref(currentHref) };
  } else if (!chosen) {
    action = { kind: "pickTime" };
  } else if (authLoading) {
    action = { kind: "waiting" };
  } else {
    action = { kind: "submit", submitting, blocked: failure?.blocksSubmit ?? false, onSubmit: submit };
  }

  if (venue.acceptsOnlineBookings === false) {
    return (
      <StateMessage title={t.web.booking.errors.offlineTitle} text={t.web.booking.errors.offlineText} />
    );
  }

  return (
    // Узел 3525:14817: колонки через 32, форма тянется (788 при 1200),
    // сводка 380. Просвет между карточками формы 16 (3525:14818).
    <div className="flex flex-col gap-8 lg:flex-row">
      <div ref={formRef} className="flex min-w-0 flex-1 flex-col gap-4">
        <WhenCard
          date={date}
          today={today}
          slot={slot}
          availability={availability}
          disabled={submitting}
          onDateChange={pickDate}
          onSlotChange={pickSlot}
        />
        <PartyCard guests={guests} disabled={submitting} onGuestsChange={pickGuests} />
        {rescheduleId ? null : (
          <>
            <ContactsCard
              value={contacts}
              errors={visibleErrors}
              disabled={submitting}
              onChange={(patch) => {
                if (submitting) return;
                setContacts((current) => ({ ...current, ...patch }));
              }}
              onBlur={(field) => setTouched((current) => new Set(current).add(field))}
            />
            <WishesCard
              notes={notes}
              wishes={wishes}
              disabled={submitting}
              onNotesChange={(next) => {
                if (!submitting) setNotes(next);
              }}
              onWishToggle={toggleWish}
            />
          </>
        )}
      </div>

      <aside className="w-full lg:w-venue-aside lg:shrink-0">
        <BookingSummary
          venue={venue}
          rows={rows}
          reschedule={rescheduleId !== null}
          failure={failure}
          action={action}
        />
      </aside>
    </div>
  );
}

const WISH_KEY_SET = new Set<string>(["window", "birthday", "highChair", "quiet", "terrace"]);

function isWishKey(value: string): value is WishKey {
  return WISH_KEY_SET.has(value);
}

/** «Столик у окна, День рождения. Отмечаем юбилей» — чипы через запятую,
 * свободный текст после точки. Пусто, если нечего сказать. */
export function composeNotes(chips: string[], text: string): string {
  const free = text.trim();
  const head = chips.join(", ");
  if (head && free) return `${head}. ${free}`;
  return head || free;
}
