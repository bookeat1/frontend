"use client";

import { useEffect, useState } from "react";
import type { AvailabilitySlot, Restaurant } from "@bookeat/api/client";

import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { TimeSlot } from "@web/components/ui/TimeSlot";
import { DateField, GuestsField } from "@web/components/venue/BookingFields";
import { readBookingDraft, writeBookingDraft } from "@web/lib/booking-draft";
import { bookingHref } from "@web/lib/booking-link";
import { DEFAULT_GUESTS } from "@web/lib/booking-options";
import { emptyKind, slotAriaLabel } from "@web/lib/booking-slots";
import { bookingDateLabel, slotDateIso, slotTimeLabel, todayIso } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";
import { useAvailability } from "@web/lib/queries";

/**
 * Карточка брони в правой колонке страницы заведения.
 *
 * МАКЕТ: Figma **QovvuAoI9YxsLMwWkfgKN8**, узел `3525:14731` (он же в кадрах
 * `3525:14561` и `3525:14611`). Числа — в `webBookingCard`
 * (`packages/design-tokens/src/web.ts`), там же у каждого номер узла.
 *
 * ЧТО ОНА ДЕЛАЕТ: даёт выбрать день, компанию и время и ВЕДЁТ на страницу
 * бронирования (`/venues/:id/book`, узел 3525:14815), унося выбор в адресе.
 * Саму бронь она НЕ создаёт. Раньше создавала — и упиралась в тупик: бронь
 * оформлялась на имя из профиля, а гостю с пустым именем (вход по коду
 * создаёт учётную запись без имени) карточка честно отвечала «заполните имя в
 * приложении». Имя и телефон теперь вводятся на странице бронирования, где для
 * них есть поля (узлы 3525:14905 и 3525:14909), и тупика нет.
 *
 * ЧТО В МАКЕТЕ ЕСТЬ И СДЕЛАНО: заголовок с подписью, поля «Дата» и «Гости»,
 * заголовок «Свободное время», сетка 4×N со свободными, выбранным и
 * недоступным слотом, кнопка в две строки.
 *
 * ЧЕГО В МАКЕТЕ НЕТ ВОВСЕ — там один экземпляр «слоты есть, время выбрано»:
 *   • загрузка, сбой связи, «свободного времени нет»;
 *   • наведение, нажатие и рамка фокуса у слота;
 *   • вид кнопки, когда время не выбрано.
 * Всё это собрано из уже существующих примитивов сайта (`AsyncBlock`,
 * `StateMessage`, `Skeleton`, неактивная кнопка кита 3274:17), а не подобрано
 * на глаз. В отчёте владельцу оно перечислено как несверенное.
 *
 * ЧТО НАРИСОВАНО, НО НЕ СДЕЛАНО: слово «зал» в подписи кнопки («25 августа ·
 * 2 гостя · зал»). Зоны посадки в ответе `GET /restaurants/:id/availability`
 * нет ни поля, ни справочника — подставить туда было бы нечего, кроме
 * выдумки.
 *
 * ГЛАВНОЕ ПРАВИЛО ДАННЫХ: бронируемость слота решает ТОЛЬКО `available`.
 * `freeTables` для этого не годится — у заведения без заведённых столиков он
 * равен нулю у каждого слота (проверено на тесте 2026-07-25, см.
 * `bugs/bookeat-frontend-slot-freetables-not-a-signal`).
 */
export function BookingCard({ venue }: { venue: Restaurant }) {
  const { t, locale } = useLocale();

  /**
   * Дата появляется ПОСЛЕ гидратации: «сегодня» знает только браузер, у
   * сервера свой часовой пояс, и посчитанное в разметке значение разошлось бы
   * с браузерным — это ошибка гидратации. До этого момента запрос выключен.
   */
  const [today, setToday] = useState<string | null>(null);
  /** `null` — до гидратации, `""` — гость очистил поле (Chrome шлёт пустую
   * строку, когда стёрты сегменты даты). Это разные состояния: первое ждёт
   * браузер, второе ждёт гостя. */
  const [date, setDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(DEFAULT_GUESTS);
  const [slot, setSlot] = useState<string | null>(null);

  useEffect(() => {
    const iso = todayIso();
    setToday(iso);
    // Гость мог уйти и вернуться посреди выбора: черновик этого заведения
    // возвращает субботу, четверых и 20:00 — а не пустую карточку.
    const draft = readBookingDraft(venue.id, iso);
    if (draft) {
      setDate(draft.date);
      setGuests(draft.guests);
      setSlot(draft.slot);
      return;
    }
    setDate((current) => current ?? iso);
  }, [venue.id]);

  useEffect(() => {
    // До гидратации сохранять нечего: значения ещё не гостя.
    if (today === null || date === null) return;
    writeBookingDraft(venue.id, { date, guests, slot });
  }, [venue.id, today, date, guests, slot]);

  const availability = useAvailability({
    restaurantId: venue.id,
    date,
    guests,
    acceptsOnlineBookings: venue.acceptsOnlineBookings,
  });

  const slots = availability.data?.slots;
  const chosen = slots?.find((item) => item.startsAt === slot && item.available) ?? null;

  function pickDate(next: string) {
    setDate(next);
    // Слот принадлежит дню: оставить выбранным «19:30» от вчера значило бы
    // унести на страницу бронирования время, которого нет в новой выдаче.
    setSlot(null);
  }

  function pickGuests(next: number) {
    setGuests(next);
    // И компании тоже: доступность считается на размер компании, ответ на
    // двоих ничего не говорит о шестерых.
    setSlot(null);
  }

  const dateText = date ? bookingDateLabel(date, locale) : null;
  /**
   * Вторая строка кнопки — про ДЕНЬ СЛОТА, а не про выбранную дату. Заведение
   * до 02:00 отдаёт для 25 августа старты вплоть до «26 августа 00:30»;
   * подпись «25 августа · 00:30» отправила бы гостя не в ту ночь.
   */
  const summaryDate = chosen ? slotDateIso(chosen.startsAt) : date;
  const summaryDateText = summaryDate ? bookingDateLabel(summaryDate, locale) : null;
  const summary = summaryDateText
    ? t.web.venue.booking.summary(summaryDateText, t.web.format.guests(guests))
    : null;
  /** Пустота, если данные приехали, — какая именно, решает `emptyKind`. */
  const empty = slots ? emptyKind(slots) : null;

  return (
    // Узел 3525:14731: 380 широкая (её задаёт колонка), радиус 20, паддинг 24,
    // просвет 24, тень 0 8 28 −4, обводка 1 px #DADADA. Обводка — именно
    // `line-strong` наших токенов: в макете переменная называется
    // `border/default`, но её значение #DADADA, а одноимённый токен сайта —
    // #E7E7E7 (см. `webVenuePage.asideCard`).
    <section
      aria-labelledby={BOOKING_TITLE_ID}
      className="flex flex-col gap-6 overflow-hidden rounded-xl border border-line-strong bg-canvas p-6 shadow-aside"
    >
      <header className="flex flex-col gap-1">
        <h2
          id={BOOKING_TITLE_ID}
          className="text-aside-card-title tracking-[-0.2px] text-ink"
        >
          {t.web.venue.booking.title}
        </h2>
        <p className="text-booking-subtitle text-ink-secondary">
          {t.web.venue.booking.subtitle}
        </p>
      </header>

      {venue.acceptsOnlineBookings === false ? (
        // Заведение не принимает брони через сайт ни на одну дату. Поле даты
        // здесь было бы приглашением в тупик, поэтому его нет вовсе.
        <StateMessage text={t.web.venue.booking.offlineText} title={t.web.venue.booking.offlineTitle} />
      ) : (
        <>
          <div className="flex gap-3">
            <DateField
              id="venue-booking-date"
              value={date}
              min={today}
              label={t.web.venue.booking.dateLabel}
              shown={dateText}
              disabled={false}
              onChange={pickDate}
            />
            <GuestsField
              id="venue-booking-guests"
              value={guests}
              label={t.web.venue.booking.guestsLabel}
              disabled={false}
              onChange={pickGuests}
            />
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-booking-slots-title text-ink-secondary">
              {t.web.venue.booking.slotsTitle}
            </h3>
            {date === "" ? (
              // Поле очищено — запрос доступности выключен, и `AsyncBlock`
              // показывал бы загрузку вечно. Это не загрузка, это ожидание
              // гостя. Подставлять «сегодня» нельзя: Chrome шлёт пустую строку
              // и посреди набора новой даты, и подстановка перебила бы ввод.
              <StateMessage text={t.web.venue.booking.pickDateText} />
            ) : (
              <AsyncBlock
                query={availability}
                emptyText={t.web.venue.booking.emptyDay}
                isEmpty={(data) => emptyKind(data.slots) !== null}
                empty={<StateMessage text={t.web.venue.booking[EMPTY_TEXT_KEY[empty ?? "day"]]} />}
                skeleton={<SlotsSkeleton />}
              >
                {(data) => (
                  <div
                    role="group"
                    aria-label={t.web.venue.booking.slotsLabel}
                    className="grid grid-cols-slots gap-2"
                  >
                    {data.slots.map((item) => (
                      <TimeSlot
                        key={item.startsAt}
                        size="grid"
                        time={slotTimeLabel(item.startsAt)}
                        label={slotAriaLabel(item, t.web.venue.booking)}
                        selected={item.startsAt === slot}
                        disabled={!item.available}
                        onSelect={() => setSlot(item.startsAt)}
                      />
                    ))}
                  </div>
                )}
              </AsyncBlock>
            )}
          </div>

          <SubmitLink venueId={venue.id} date={date} guests={guests} slot={chosen} summary={summary} />
        </>
      )}
    </section>
  );
}

const BOOKING_TITLE_ID = "venue-booking-title";

/**
 * Кнопка в две строки (узел 3525:14768) — на самом деле ССЫЛКА на страницу
 * бронирования, потому что по нажатию гость ПЕРЕХОДИТ: у ссылки есть «открыть
 * в новой вкладке» и адрес в строке состояния, у кнопки с `router.push` — нет.
 *
 * Пока время не выбрано, это неактивная кнопка «Выберите время»:
 * «Забронировать» без времени было бы ссылкой, которой нечего бронировать.
 * Вход здесь НЕ проверяется: страница бронирования сама скажет гостю без
 * сессии, что нужен вход, и вернёт его на себя с тем же выбором.
 */
function SubmitLink({
  venueId,
  date,
  guests,
  slot,
  summary,
}: {
  venueId: string;
  date: string | null;
  guests: number;
  slot: AvailabilitySlot | null;
  summary: string | null;
}) {
  const { t } = useLocale();

  if (!slot) {
    return (
      <Button size="booking" block disabled>
        <span>{t.web.venue.booking.pickTime}</span>
      </Button>
    );
  }

  // Черновик карточки здесь НЕ чистится: гость может вернуться со страницы
  // бронирования кнопкой «назад», и карточка обязана показать тот же выбор.
  // Чистит его страница бронирования после успешной брони.
  return (
    <Button size="booking" block asLink href={bookingHref(venueId, { date, guests, slot: slot.startsAt })}>
      <span>{t.web.venue.booking.submit(slotTimeLabel(slot.startsAt))}</span>
      {summary ? <span className="text-booking-cta-sub text-on-brand-subtle">{summary}</span> : null}
    </Button>
  );
}

/** Скелет сетки: ровно две строки по четыре слота той же высоты, что живые.
 * Карточка не должна прыгать, когда приедет ответ. */
function SlotsSkeleton() {
  return (
    <div className="grid grid-cols-slots gap-2">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-slot-grid w-full rounded-slot-grid" />
      ))}
    </div>
  );
}

const EMPTY_TEXT_KEY = {
  day: "emptyDay",
  capacity: "emptyCapacity",
  late: "emptyLate",
  taken: "emptyTaken",
} as const;
