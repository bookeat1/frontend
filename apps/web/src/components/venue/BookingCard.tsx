"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Dictionary } from "@bookeat/i18n";
import {
  RepositoryError,
  type AvailabilitySlot,
  type BookingConflictKind,
  type Restaurant,
  type SlotUnavailableReason,
} from "@bookeat/api/client";

import { AsyncBlock, Skeleton, StateMessage } from "@web/components/state/AsyncBlock";
import { Button } from "@web/components/ui/Button";
import { TimeSlot } from "@web/components/ui/TimeSlot";
import { useAuth } from "@web/lib/auth";
import { clearBookingDraft, readBookingDraft, writeBookingDraft } from "@web/lib/booking-draft";
import { DEFAULT_GUESTS, GUEST_OPTIONS } from "@web/lib/booking-options";
import { cx } from "@web/lib/cx";
import { useLoginHref } from "@web/lib/favorites";
import { bookingDateLabel, slotDateIso, slotTimeLabel, todayIso } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";
import { useAvailability, useCreateBooking } from "@web/lib/queries";

/**
 * Карточка брони в правой колонке страницы заведения.
 *
 * МАКЕТ: Figma **QovvuAoI9YxsLMwWkfgKN8**, узел `3525:14731` (он же в кадрах
 * `3525:14561` и `3525:14611`). Числа — в `webBookingCard`
 * (`packages/design-tokens/src/web.ts`), там же у каждого номер узла.
 *
 * ЧТО В МАКЕТЕ ЕСТЬ И СДЕЛАНО: заголовок с подписью, поля «Дата» и «Гости»,
 * заголовок «Свободное время», сетка 4×N со свободными, выбранным и
 * недоступным слотом, кнопка в две строки.
 *
 * ЧЕГО В МАКЕТЕ НЕТ ВОВСЕ — там один экземпляр «слоты есть, время выбрано»:
 *   • загрузка, сбой связи, «свободного времени нет», «бронь создана»;
 *   • гость без входа;
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
  const { signedIn, isLoading: authLoading, user } = useAuth();
  const loginHref = useLoginHref();

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
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  /**
   * Что именно забронировано. Хранится ОТДЕЛЬНО от ответа сервера сознательно:
   * `Booking.startsAt` приходит в UTC («RFC3339 UTC as stored by the backend»),
   * а гостю надо показать стенные часы заведения — то есть ту самую строку
   * слота, которую он нажал. Брать её из выдачи доступности после успеха тоже
   * нельзя: выдача уже перезапрошена, и этого слота в ней больше нет.
   */
  const [confirmed, setConfirmed] = useState<{ startsAt: string; guests: number } | null>(null);

  /** Подтверждение получает фокус: кнопка, на которой он стоял, исчезает
   * вместе с формой, и без этого фокус проваливается в `body`. */
  const confirmedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const iso = todayIso();
    setToday(iso);
    // Гость мог уйти на вход посреди выбора: черновик этого заведения
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

  useEffect(() => {
    if (confirmed) confirmedRef.current?.focus();
  }, [confirmed]);

  const availability = useAvailability({
    restaurantId: venue.id,
    date,
    guests,
    acceptsOnlineBookings: venue.acceptsOnlineBookings,
  });
  const create = useCreateBooking();

  const slots = availability.data?.slots;
  const chosen = slots?.find((item) => item.startsAt === slot && item.available) ?? null;

  /**
   * Ключ идемпотентности живёт ровно столько, сколько живёт ВЫБОР.
   *
   * Тот же ключ на повтор той же брони — тогда второе нажатие и повтор
   * запроса после обрыва связи не дают второй стол. Новый выбор — новый ключ,
   * иначе сервер ответил бы «этот ключ уже использован» на честно другую
   * бронь.
   *
   * Ссылка, а не `useMemo`: `useMemo` React вправе сбросить когда угодно, и
   * тогда ключ поменялся бы без единой правки выбора — ровно то, чего здесь
   * допускать нельзя. Присваивание в рендере идемпотентно: при неизменном
   * выборе оно не делает ничего.
   */
  const selection = `${venue.id}|${date}|${guests}|${slot}`;
  const idempotency = useRef<{ selection: string; key: string } | null>(null);
  if (idempotency.current?.selection !== selection) {
    idempotency.current = { selection, key: newIdempotencyKey() };
  }
  const idempotencyKey = idempotency.current.key;

  /**
   * Пока бронь летит на сервер, выбор ЗАМОРОЖЕН — и в разметке (поля
   * выключены), и здесь (изменение отбрасывается).
   *
   * Раньше смена даты или гостей звала `create.reset()`. В TanStack Query v5
   * `reset()` отписывает наблюдателя от мутации, и `onSuccess`, переданный в
   * `mutate()`, уже не вызывается: сервер бронь создал, а карточка
   * подтверждение не показала. Гость жал снова — с НОВЫМ ключом
   * идемпотентности, потому что выбор изменился, — и получал второй стол.
   * Поэтому `create.reset()` здесь нет вовсе: `create.error` и `create.data`
   * никто не читает, а «в полёте» решает только `isPending`.
   */
  function pickDate(next: string) {
    if (create.isPending) return;
    setDate(next);
    // Слот принадлежит дню: оставить выбранным «19:30» от вчера значило бы
    // отправить на сервер время, которого нет в новой выдаче.
    setSlot(null);
    setFailure(null);
  }

  function pickGuests(next: number) {
    if (create.isPending) return;
    setGuests(next);
    // И компании тоже: доступность считается на размер компании, ответ на
    // двоих ничего не говорит о шестерых.
    setSlot(null);
    setFailure(null);
  }

  /**
   * Вошёл, а профиля нет: `AuthProvider` намеренно переживает падение
   * `GET /me` после ввода кода (токены на месте, вход состоялся), и тогда
   * `signedIn === true` при `user === null`. Телефон — обязательное поле
   * брони, взять его больше неоткуда. Кнопка в этом состоянии выключена и
   * подписана, а не активна и молчалива.
   */
  const profileMissing = signedIn && !authLoading && !(user?.phone ?? "").trim();

  function submit() {
    if (!chosen || !signedIn || profileMissing) return;
    const name = (user?.fullName ?? "").trim();
    const phone = (user?.phone ?? "").trim();
    if (!name) {
      setFailure({ title: t.web.venue.booking.noNameTitle, text: t.web.venue.booking.noNameText });
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
          name,
          phone,
        },
        idempotencyKey,
      },
      {
        onSuccess: () => {
          setConfirmed({ startsAt: chosen.startsAt, guests });
          // Забронированный выбор — больше не черновик: после перезагрузки
          // карточка не должна предлагать тот же слот ещё раз.
          clearBookingDraft(venue.id);
        },
        onError: (error) => setFailure(describeFailure(error, t, () => setSlot(null))),
      },
    );
  }

  const dateText = date ? bookingDateLabel(date, locale) : null;
  /**
   * Вторая строка кнопки — про ДЕНЬ СЛОТА, а не про выбранную дату. Заведение
   * до 02:00 отдаёт для 25 августа старты вплоть до «26 августа 00:30»;
   * подпись «25 августа · 00:30» отправила бы гостя не в ту ночь, а
   * подтверждение после успеха (оно считается от `confirmed.startsAt`) с ней
   * разошлось бы.
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
      ) : confirmed ? (
        // Форма целиком заменяется сообщением, поэтому у него роль `status`
        // (диктор произносит его сам) и фокус (см. `confirmedRef`): иначе
        // фокус с исчезнувшей кнопки уходит в `body`, и следующий Tab
        // начинает страницу с начала.
        <div
          ref={confirmedRef}
          role="status"
          aria-live="polite"
          tabIndex={-1}
          className="rounded-lg"
        >
          <StateMessage
            title={t.web.venue.booking.createdTitle}
            text={t.web.venue.booking.createdText(
              bookingDateLabel(slotDateIso(confirmed.startsAt) ?? "", locale) ?? "",
              slotTimeLabel(confirmed.startsAt),
              t.web.format.guests(confirmed.guests),
            )}
          />
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <DateField
              value={date}
              min={today}
              label={t.web.venue.booking.dateLabel}
              shown={dateText}
              disabled={create.isPending}
              onChange={pickDate}
            />
            <GuestsField
              value={guests}
              label={t.web.venue.booking.guestsLabel}
              disabled={create.isPending}
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
                        label={slotAriaLabel(item, t)}
                        selected={item.startsAt === slot}
                        disabled={!item.available}
                        onSelect={() => {
                          setSlot(item.startsAt);
                          setFailure(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </AsyncBlock>
            )}
          </div>

          {failure ? (
            <StateMessage title={failure.title} text={failure.text} tone="danger" />
          ) : null}

          {profileMissing ? (
            <StateMessage
              title={t.web.venue.booking.profileMissingTitle}
              text={t.web.venue.booking.profileMissingText}
            >
              <Button size="m" variant="secondary" onClick={() => window.location.reload()}>
                {t.web.venue.booking.reloadPage}
              </Button>
            </StateMessage>
          ) : null}

          <SubmitButton
            slot={chosen}
            summary={summary}
            signedIn={signedIn}
            authLoading={authLoading}
            profileMissing={profileMissing}
            loginHref={loginHref}
            submitting={create.isPending}
            blocked={failure?.blocksSubmit ?? false}
            onSubmit={submit}
          />
        </>
      )}
    </section>
  );
}

const BOOKING_TITLE_ID = "venue-booking-title";

/**
 * Кнопка в две строки (узел 3525:14768).
 *
 * У неё ТРИ разных облика, и все три — про честность, а не про красоту:
 *   • время не выбрано → «Выберите время», кнопка неактивна. «Забронировать»
 *     без времени — это кнопка, которой нечего бронировать;
 *   • гость не вошёл → ССЫЛКА на вход, помнящая эту страницу. Сервер берёт
 *     владельца брони из токена, анонимной брони через веб не существует, и
 *     кнопка, которая молча выкидывает на вход, хуже честной ссылки;
 *   • вошёл, но профиль не приехал → кнопка выключена и говорит почему
 *     (второй строкой), а совет — в плашке над ней;
 *   • иначе → отправка, на время которой кнопка заблокирована.
 */
function SubmitButton({
  slot,
  summary,
  signedIn,
  authLoading,
  profileMissing,
  loginHref,
  submitting,
  blocked,
  onSubmit,
}: {
  slot: AvailabilitySlot | null;
  summary: string | null;
  signedIn: boolean;
  authLoading: boolean;
  profileMissing: boolean;
  loginHref: string;
  submitting: boolean;
  blocked: boolean;
  onSubmit: () => void;
}) {
  const { t } = useLocale();

  if (!slot) {
    return (
      <Button size="booking" block disabled>
        <span>{t.web.venue.booking.pickTime}</span>
      </Button>
    );
  }

  const title = t.web.venue.booking.submit(slotTimeLabel(slot.startsAt));

  // Пока сессия читается из хранилища, гость ещё не «не вошёл»: показать ему
  // ссылку на вход и через миг подменить её кнопкой — это мигание, на котором
  // легко промахнуться пальцем.
  if (!signedIn && !authLoading) {
    return (
      <Button size="booking" block asLink href={loginHref}>
        <span>{title}</span>
        <span className="text-booking-cta-sub text-on-brand-subtle">
          {t.web.venue.booking.signInHint}
        </span>
      </Button>
    );
  }

  if (profileMissing) {
    return (
      <Button size="booking" block disabled>
        <span>{title}</span>
        <span className="text-booking-cta-sub">{t.web.venue.booking.profileMissingHint}</span>
      </Button>
    );
  }

  return (
    <Button
      size="booking"
      block
      loading={submitting}
      disabled={authLoading || blocked}
      onClick={onSubmit}
    >
      <span>{title}</span>
      {summary ? (
        <span
          className={
            authLoading || blocked ? "text-booking-cta-sub" : "text-booking-cta-sub text-on-brand-subtle"
          }
        >
          {summary}
        </span>
      ) : null}
    </Button>
  );
}

/**
 * Поле «Дата» (узлы 3525:14736…14740).
 *
 * Поле НАСТОЯЩЕЕ, `input[type=date]`: календарь, клавиатура и системный
 * формат ввода достаются бесплатно. Но печатает оно значение в формате
 * БРАУЗЕРА («mm/dd/yyyy»), а в макете стоит «25 августа», и ни `lang`, ни
 * `Intl` на это не влияют, — поэтому свой текст лежит поверх прозрачного
 * значения, а в фокусе показывается родное содержимое: иначе гость правил бы
 * невидимые для себя цифры. Тот же приём, что в панели поиска.
 */
function DateField({
  value,
  min,
  label,
  shown,
  disabled,
  onChange,
}: {
  value: string | null;
  /** Нижняя граница календаря — СЕГОДНЯ, а не выбранный день: иначе, выбрав
   * пятницу, гость больше не смог бы вернуться на четверг. */
  min: string | null;
  label: string;
  shown: string | null;
  /** Бронь в полёте: менять день нельзя, см. `pickDate`. */
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <FieldShell label={label} htmlFor="venue-booking-date">
      <div className="grid min-w-0 flex-1">
        <input
          id="venue-booking-date"
          type="date"
          value={value ?? ""}
          min={min ?? undefined}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onClick={openPicker}
          className="search-native-picker peer col-start-1 row-start-1 w-full cursor-pointer bg-transparent text-booking-value text-transparent outline-none focus:text-ink disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cx(
            "pointer-events-none col-start-1 row-start-1 self-center truncate text-booking-value peer-focus:invisible",
            disabled ? "text-ink-disabled" : "text-ink",
          )}
        >
          {shown ?? ""}
        </span>
      </div>
    </FieldShell>
  );
}

/** Поле «Гости» (узлы 3525:14741…14745). Родной `select`: его список умеет
 * открывать клавиатура, и он же печатает «2 гостя» сам — своей подписи
 * поверх, в отличие от даты, не требуется. */
function GuestsField({
  value,
  label,
  disabled,
  onChange,
}: {
  value: number;
  label: string;
  /** Бронь в полёте: менять компанию нельзя, см. `pickGuests`. */
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const { t } = useLocale();
  return (
    <FieldShell label={label} htmlFor="venue-booking-guests">
      <select
        id="venue-booking-guests"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-booking-value text-ink outline-none disabled:cursor-not-allowed disabled:text-ink-disabled"
      >
        {GUEST_OPTIONS.map((count) => (
          <option key={count} value={count}>
            {t.web.format.guests(count)}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Общая оболочка поля: подпись 14/18 через 6 над рамкой радиуса 12 с
 * паддингом 14/12 и значком 24 справа (узлы 3525:14737 и 3525:14738). */
function FieldShell({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label className="text-booking-label text-ink-secondary" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-md border border-line-control bg-canvas px-booking-field-x py-booking-field-y">
        {children}
        <ChevronDown />
      </div>
    </div>
  );
}

/**
 * Значок обоих полей — узел 3525:14740, выгружен из макета как SVG 24×24:
 * одна ломаная, обводка 1.2, скруглённые концы. Набирать его символом «▾»
 * нельзя: в макете это вектор, а не текст.
 */
function ChevronDown() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none h-booking-field-icon w-booking-field-icon shrink-0"
    >
      <path
        d="M6.24492 10.2262L11.8449 15.0262L17.4449 10.2262"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

/**
 * Открыть родной календарь кликом по ЛЮБОМУ месту поля: штатно это делает
 * только кнопка справа, а её мы прячем — в макете её нет.
 */
function openPicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // Браузер отказался — поле по-прежнему редактируется с клавиатуры.
  }
}

/**
 * ЧЕТЫРЕ РАЗНЫЕ ПУСТОТЫ, а не одна.
 *
 * Сервер отвечает по-разному, и совет гостю в каждом случае свой:
 *   • слотов нет вовсе — у заведения нет рабочих часов на этот день;
 *   • все слоты `capacity` — столика на такую компанию нет (в том числе когда
 *     столиков не заведено вообще), и «попробуйте другую дату» отправило бы
 *     гостя по кругу;
 *   • все слоты `too_soon` — день уже прошёл: до каждого оставшегося времени
 *     меньше, чем `BOOKING_DEFAULT_LEAD_MINUTES`. Именно так тестовый сервер
 *     отвечает вечером (проверено 02.09.2026 в 23:30 по Алматы: 28 слотов,
 *     все `too_soon`), и «всё занято» здесь было бы неправдой — не занято, а
 *     поздно;
 *   • иначе всё занято — другой день или другое число гостей.
 *
 * `null` — свободное время есть, пустотой это не является.
 */
export function emptyKind(
  slots: AvailabilitySlot[],
): "day" | "capacity" | "late" | "taken" | null {
  if (slots.length === 0) return "day";
  if (slots.some((item) => item.available)) return null;
  if (slots.every((item) => item.reason === "capacity")) return "capacity";
  if (slots.every((item) => item.reason === "too_soon")) return "late";
  return "taken";
}

const EMPTY_TEXT_KEY = {
  day: "emptyDay",
  capacity: "emptyCapacity",
  late: "emptyLate",
  taken: "emptyTaken",
} as const;

/** Недоступный слот ПОКАЗЫВАЕТСЯ с причиной, а не прячется: серый
 * прямоугольник без объяснения читается как поломка вёрстки, а диктор
 * произносит его неотличимо от свободного. */
function slotAriaLabel(slot: AvailabilitySlot, t: Dictionary): string | undefined {
  if (slot.available) return undefined;
  const time = slotTimeLabel(slot.startsAt);
  return t.web.venue.booking.slotLabel(time, REASON_TEXT(t)[slot.reason ?? "unknown"]);
}

const REASON_TEXT = (t: Dictionary): Record<SlotUnavailableReason, string> => ({
  too_soon: t.web.venue.booking.reason.tooSoon,
  beyond_horizon: t.web.venue.booking.reason.beyondHorizon,
  occupied: t.web.venue.booking.reason.occupied,
  capacity: t.web.venue.booking.reason.capacity,
  unknown: t.web.venue.booking.reason.unknown,
});

interface SubmitFailure {
  title: string;
  text: string;
  /** Бронь ТОЧНО существует — отправлять снова нельзя ни при каких условиях. */
  blocksSubmit?: boolean;
}

/**
 * Отказ сервера — словами гостя.
 *
 * ВЕТВИМСЯ ПО МАШИННОМУ КОДУ, НИКОГДА ПО ТЕКСТУ ОШИБКИ. На этом уже стоял
 * баг в приложении: предикат «бронь уже есть» опознавался по подстроке
 * `already exists`, а сервер отдавал тот же текст и при обычной гонке за слот,
 * и гостю сообщали о брони, которой не было
 * (`bugs/bookeat-frontend-409-told-guest-a-booking-that-never-existed`).
 *
 * Неизвестный код — ОТДЕЛЬНЫЙ исход, а не «значит, стол занят» и не «значит,
 * бронь есть»: цена ошибки в эту сторону — гость, который не пришёл в
 * ресторан, потому что был уверен, что стол за ним.
 */
function describeFailure(
  error: unknown,
  t: Dictionary,
  dropSlot: () => void,
): SubmitFailure {
  const conflict = error instanceof RepositoryError ? error.bookingConflict : null;
  if (conflict) return conflictFailure(conflict, t, dropSlot);
  if (error instanceof RepositoryError && error.isValidation) {
    return {
      title: t.web.venue.booking.errorValidationTitle,
      text: t.web.venue.booking.errorValidationText,
    };
  }
  return { title: t.web.venue.booking.errorTitle, text: t.web.venue.booking.errorText };
}

function conflictFailure(
  conflict: BookingConflictKind,
  t: Dictionary,
  dropSlot: () => void,
): SubmitFailure {
  switch (conflict) {
    case "slot_taken":
      // Брони НЕТ: стол увели, пока гость выбирал. Снимаем выбор, чтобы
      // кнопка не предлагала отправить то же самое ещё раз.
      dropSlot();
      return {
        title: t.web.venue.booking.errorSlotTakenTitle,
        text: t.web.venue.booking.errorSlotTakenText,
      };
    case "no_table_available":
      dropSlot();
      return {
        title: t.web.venue.booking.errorNoTableTitle,
        text: t.web.venue.booking.errorNoTableText,
      };
    case "idempotency_key_reused":
      // Здесь бронь ТОЧНО есть. Повторная отправка дала бы второй стол,
      // поэтому кнопка блокируется до смены выбора.
      return {
        title: t.web.venue.booking.errorDuplicateTitle,
        text: t.web.venue.booking.errorDuplicateText,
        blocksSubmit: true,
      };
    case "unknown":
      return {
        title: t.web.venue.booking.errorAmbiguousTitle,
        text: t.web.venue.booking.errorAmbiguousText,
      };
  }
}

/**
 * Ключ идемпотентности. `crypto.randomUUID` есть во всех браузерах, где
 * работает сайт, но не в каждом окружении сборки и тестов — запасной путь
 * собирает то же самое из `getRandomValues`, а не из `Math.random`.
 */
function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi?.getRandomValues?.(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
