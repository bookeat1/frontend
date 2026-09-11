"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Calendar } from "@web/components/ui/Calendar";
import { WheelPicker } from "@web/components/ui/WheelPicker";
import { DEFAULT_GUESTS, GUEST_OPTIONS } from "@web/lib/booking-options";
import { cx } from "@web/lib/cx";
import { serializeCatalogParams, type CatalogState } from "@web/lib/catalog-params";
import { formatHhMm, nowTimeHhMm, parseHhMm, searchDateLabel, todayIso } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";
import { useDismissable } from "@web/lib/use-dismissable";

/**
 * Панель поиска. Один компонент на два места макета:
 *   • «Search panel» героя главной (узел 3253:36) — белая плашка 1200×72 с
 *     радиусом 20, паддингом 8 по горизонтали и просветом между полями 2;
 *   • строка поиска листинга (узел 3258:2) — та же четвёрка полей под шапкой.
 * Второй экземпляр вместо копии — потому что поля, их порядок и то, во что
 * они превращаются в адресной строке, обязаны совпадать: гость, набравший
 * запрос в герое, попадает на листинг с теми же значениями в тех же полях.
 *
 * ЧИСЛА ИЗ МАКЕТА, а не подобранные: панель 72 высотой, поля с радиусом 14 и
 * паддингом 8/20, разделители 1×72 (во всю высоту панели, не по высоте
 * текста), дата 190, время 130, гости 140, кнопка 168×48 с радиусом 14.
 * Всё это лежит в `webSearchPanel` (`packages/design-tokens/src/web.ts`).
 *
 * ДАТА И ВРЕМЯ ЗАПОЛНЕНЫ ПО УМОЛЧАНИЮ — сегодняшним днём и текущим временем
 * (замечание владельца 31.08.2026; в макете 3253:43/3253:47 поля тоже
 * заполнены). Прежнее решение было обратным, и у него была причина: пара
 * «дата + гости» включает серверный фильтр доступности, а он на тестовом
 * стенде отсекает большую часть каталога. Причина никуда не делась, поэтому
 * подставленные значения — это ЧЕРНОВИК формы: пока гость не нажал «Найти»,
 * ничего не отфильтровано, а на листинге применённые дата и время видны
 * отдельными чипами над выдачей.
 *
 * Оба значения появляются ПОСЛЕ гидратации: «сегодня» и «сейчас» знает только
 * браузер, у сервера свой часовой пояс, и посчитанное в разметке значение
 * разошлось бы с браузерным — это ошибка гидратации.
 *
 * КАЛЕНДАРЬ, КОЛЕСО ВРЕМЕНИ И КОЛЕСО ГОСТЕЙ (добавлено по задаче «виджет
 * выбора даты/времени/гостей», Figma `qmMsg4jO1ggmyEHNIAD2ll`, узлы
 * `5177:12242`/`5178:19076`/`5178:19173`). Первый заход (2026-09-11, утро) на
 * эти три узла упёрся в 429 у `/v1/files/:key` и `/v1/images` — время и гости
 * тогда сделали заглушками (список получасовых слотов, степпер `−`/`+`).
 * Второй заход (тот же день, после доступа к DesignAgent-мосту) разобрал
 * реальный макет по СКРИНШОТАМ узлов (REST по-прежнему 429, `retry-after`
 * ~11.5 часа) — оба узла времени и гостей это ОДИН компонент кита,
 * «колесо со стрелками» (`WheelPicker`, см. его комментарий): шеврон
 * вверх/вниз листает значение на ±1, зациклено (после 23 часов — 00, после
 * 59 минут — 00, после 8 гостей — 1 и обратно), текущее значение — большое
 * число в сплошном фирменном круге, соседние — серым мельче. Список
 * получасовых слотов и степпер `−`/`+` убраны — это была заглушка, а не
 * альтернативный путь. Нативные `input[type=date|time]` ОСТАЮТСЯ под
 * капотом — значение по-прежнему можно набрать с клавиатуры, попап лишь
 * даёт способ выбрать мышью, не открывая календарь операционной системы.
 */
export function SearchPanel({
  state,
  variant = "hero",
}: {
  state: CatalogState;
  variant?: "hero" | "bar";
}) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [text, setText] = useState(state.text);
  const [date, setDate] = useState(state.date ?? "");
  const [time, setTime] = useState(state.time ?? "");
  const [guests, setGuests] = useState(state.guests ?? DEFAULT_GUESTS);
  const [today, setToday] = useState<string | null>(null);
  /** Какой попап открыт — сразу один, второй закрывается сам. */
  const [openPopover, setOpenPopover] = useState<"date" | "time" | "guests" | null>(null);
  const dateFieldRef = useRef<HTMLDivElement>(null);
  const timeFieldRef = useRef<HTMLDivElement>(null);
  const guestsFieldRef = useRef<HTMLDivElement>(null);

  useDismissable(openPopover === "date", dateFieldRef, () => setOpenPopover(null));
  useDismissable(openPopover === "time", timeFieldRef, () => setOpenPopover(null));
  useDismissable(openPopover === "guests", guestsFieldRef, () => setOpenPopover(null));

  /**
   * Дата/время пришли из адреса (гость их выбирал раньше — на листинге, до
   * возврата сюда) или гость руками тронул поле в ЭТОЙ форме — тогда «когда
   * есть свободный столик» действительно то, что он спрашивает, и парой
   * `date`+`guests` стоит включать серверный фильтр доступности.
   *
   * Если же оба поля пустые и подставлены ТОЛЬКО автозаполнением (см. ниже),
   * это черновик, а не выбор: обычный поиск заведения по названию иначе
   * находил бы 0 совпадений всякий раз, когда искомое заведение просто
   * закрыто в эту самую минуту (проверено вживую 2026-09-06: `q=Abay` без
   * даты/времени — 1 совпадение, тот же запрос с автоподставленными
   * «сегодня» + «сейчас» — 0, при том что `Abay` совпадает по имени и просто
   * не работает по воскресеньям). Гость, который печатает конкретное имя,
   * ищет ЗАВЕДЕНИЕ, а не «стол прямо сейчас».
   */
  const availabilityTouched = useRef(Boolean(state.date || state.time));

  useEffect(() => {
    const iso = todayIso();
    setToday(iso);
    // Черновые значения подставляем ОДИН раз и только в пустое поле: если
    // адрес принёс свою дату — она главнее, а если гость очистил поле руками,
    // эффект уже отработал и не вернёт значение обратно.
    setDate((current) => current || iso);
    setTime((current) => current || nowTimeHhMm());
  }, []);

  const dateLabel = date ? searchDateLabel(date, locale, t, today) : null;
  // Часы и минуты для двух колонок `WheelPicker` попапа «Время» — битую
  // или пустую строку `time` (не должно случиться после автозаполнения, но
  // поле остаётся набираемым с клавиатуры) читаем как полночь, а не роняем
  // попап.
  const wheelTime = parseHhMm(time) ?? { hour: 0, minute: 0 };

  function pickDate(iso: string) {
    availabilityTouched.current = true;
    setDate(iso);
    setOpenPopover(null);
  }

  // Колесо времени НЕ закрывает попап на каждый клик (в отличие от
  // календаря и списка-заглушки, который был раньше): часы и минуты — две
  // независимые колонки, и закрытие после первой же отменяло бы выбор
  // второй. Попап закрывается кликом вне или Escape (`useDismissable`).
  function pickHour(hour: number) {
    availabilityTouched.current = true;
    setTime(formatHhMm(hour, wheelTime.minute));
  }

  function pickMinute(minute: number) {
    availabilityTouched.current = true;
    setTime(formatHhMm(wheelTime.hour, minute));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Поиск по названию (`text` непустой) без того, чтобы гость САМ выбрал
    // дату/время в этой форме, — просто поиск заведения: автозаполненные
    // «сегодня»/«сейчас» здесь не отправляются, иначе они молча фильтруют
    // выдачу по доступности прямо в эту минуту и находят 0 совпадений у
    // заведения, которое сейчас закрыто, хотя оно есть в каталоге.
    const applyAvailability = availabilityTouched.current || !text.trim();
    const query = serializeCatalogParams({
      ...state,
      text,
      date: applyAvailability ? date || undefined : undefined,
      time: applyAvailability ? time || undefined : undefined,
      guests,
      // Любой новый поиск начинается с первой страницы: остаться на седьмой
      // после смены запроса значит показать пустоту.
      page: 1,
    });
    router.push(query ? `/venues?${query}` : "/venues");
  }

  const label = "text-[12px] font-medium leading-4 tracking-[0.1px] text-ink-tertiary";
  const input =
    "w-full bg-transparent text-[16px] font-semibold leading-6 text-ink outline-none placeholder:font-normal placeholder:text-ink-tertiary";
  // Нативные поля даты и времени печатают значение в формате БРАУЗЕРА:
  // «mm/dd/yyyy» и «--:-- --» вместо «Сегодня, 25 авг» и «19:30» из макета.
  // Ни `lang`, ни `Intl` на это не влияют. Поэтому текст самого поля делаем
  // прозрачным и кладём поверх свою подпись, а поле остаётся нативным —
  // клавиатура и ручной ввод минуты достаются бесплатно, календарь ОС —
  // нет: клик по полю открывает наш попап вместо него (см. `onClick` ниже).
  // Пока поле в фокусе, показываем родное содержимое: иначе гость правил бы
  // невидимые для себя цифры.
  const nativeValue =
    "search-native-picker peer col-start-1 row-start-1 cursor-pointer text-transparent focus:text-ink";
  const shownValue =
    "pointer-events-none col-start-1 row-start-1 self-center truncate text-[16px] leading-6 peer-focus:invisible";
  const filled = "font-semibold text-ink";
  const placeholder = "font-normal text-ink-tertiary";

  return (
    <form
      onSubmit={submit}
      className={cx(
        "flex w-full flex-wrap items-center gap-panel-gap rounded-panel bg-canvas px-panel-x py-2 lg:h-panel lg:flex-nowrap lg:py-0",
        variant === "hero" ? "shadow-panel" : "border border-line-strong",
      )}
    >
      <Field className="min-w-[220px] flex-1">
        <label className={label} htmlFor="catalog-search-text">
          {t.web.home.hero.placeLabel}
        </label>
        <input
          id="catalog-search-text"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t.web.home.hero.placePlaceholder}
          className={input}
        />
      </Field>

      <Divider />

      <div ref={dateFieldRef} className="relative w-full lg:w-search-date">
        <Field>
          <label className={label} htmlFor="catalog-search-date">
            {t.web.home.hero.dateLabel}
          </label>
          <div className="grid">
            <input
              id="catalog-search-date"
              type="date"
              value={date}
              onChange={(event) => {
                availabilityTouched.current = true;
                setDate(event.target.value);
              }}
              onClick={() => setOpenPopover((current) => (current === "date" ? null : "date"))}
              className={cx(input, nativeValue)}
            />
            <span aria-hidden="true" className={cx(shownValue, date ? filled : placeholder)}>
              {dateLabel ?? t.web.home.hero.anyDate}
            </span>
          </div>
        </Field>
        {openPopover === "date" ? (
          <Popover>
            <Calendar value={date || null} min={today} today={today} onSelect={pickDate} />
          </Popover>
        ) : null}
      </div>

      <Divider />

      <div ref={timeFieldRef} className="relative w-full lg:w-search-time">
        <Field>
          <label className={label} htmlFor="catalog-search-time">
            {t.web.home.hero.timeLabel}
          </label>
          <div className="grid">
            <input
              id="catalog-search-time"
              type="time"
              value={time}
              onChange={(event) => {
                availabilityTouched.current = true;
                setTime(event.target.value);
              }}
              onClick={() => setOpenPopover((current) => (current === "time" ? null : "time"))}
              className={cx(input, nativeValue)}
            />
            <span aria-hidden="true" className={cx(shownValue, time ? filled : placeholder)}>
              {time || t.web.home.hero.anyTime}
            </span>
          </div>
        </Field>
        {openPopover === "time" ? (
          <Popover className="w-[248px]">
            {/* Часы 0…23 и минуты 0…59, оба зациклены (узел `5178:19076`
                «select_hour_desktop») — не ограничены «разумными часами
                работы», это было допущение первого захода (см. комментарий
                компонента выше), а не контракт. Поле по-прежнему принимает
                любую минуту с клавиатуры через нативный `input[type=time]`,
                колесо — только способ выбрать мышью. */}
            <WheelPicker
              columns={[
                {
                  value: wheelTime.hour,
                  min: 0,
                  max: 23,
                  format: (value) => `${value}`.padStart(2, "0"),
                  label: t.web.home.hero.hoursLabel,
                  incrementLabel: t.web.home.hero.wheelIncrease(t.web.home.hero.hoursLabel),
                  decrementLabel: t.web.home.hero.wheelDecrease(t.web.home.hero.hoursLabel),
                  onChange: pickHour,
                },
                {
                  value: wheelTime.minute,
                  min: 0,
                  max: 59,
                  format: (value) => `${value}`.padStart(2, "0"),
                  label: t.web.home.hero.minutesLabel,
                  incrementLabel: t.web.home.hero.wheelIncrease(t.web.home.hero.minutesLabel),
                  decrementLabel: t.web.home.hero.wheelDecrease(t.web.home.hero.minutesLabel),
                  onChange: pickMinute,
                },
              ]}
            />
          </Popover>
        ) : null}
      </div>

      <Divider />

      <div ref={guestsFieldRef} className="relative w-full lg:w-search-guests">
        <Field>
          <span className={label}>{t.web.home.hero.guestsLabel}</span>
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={openPopover === "guests"}
            aria-label={`${t.web.home.hero.guestsLabel}: ${t.web.format.guests(guests)}`}
            onClick={() => setOpenPopover((current) => (current === "guests" ? null : "guests"))}
            className={cx(input, "cursor-pointer text-left")}
          >
            {t.web.format.guests(guests)}
          </button>
        </Field>
        {openPopover === "guests" ? (
          <Popover className="w-[160px]">
            {/* Один столбец того же компонента, что у времени (узел
                `5178:19173`) — один и тот же «select_hour_desktop» кита,
                просто с одной колонкой вместо двух. Диапазон — тот же
                `GUEST_OPTIONS` (1…8), что был у прежнего степпера, не новое
                ограничение. */}
            <WheelPicker
              columns={[
                {
                  value: guests,
                  min: GUEST_OPTIONS[0],
                  max: GUEST_OPTIONS[GUEST_OPTIONS.length - 1],
                  format: (value) => `${value}`,
                  label: t.web.home.hero.guestsLabel,
                  incrementLabel: t.web.home.hero.wheelIncrease(t.web.home.hero.guestsLabel),
                  decrementLabel: t.web.home.hero.wheelDecrease(t.web.home.hero.guestsLabel),
                  // Гости НЕ взводят `availabilityTouched` — как и у прежнего
                  // степпера. Флаг только про дату/время: пара `date+guests`
                  // включает серверный фильтр доступности лишь когда гость
                  // САМ выбрал КОГДА он хочет стол, а не сколько их придёт.
                  onChange: setGuests,
                },
              ]}
            />
          </Popover>
        ) : null}
      </div>

      {/* Кнопка панели поиска — НЕ `Button` кита: у той высота 54 и радиус 16,
          а макет 3253:52 рисует здесь 168×48 с радиусом 14. */}
      <button
        type="submit"
        className="ml-auto inline-flex h-submit w-full shrink-0 items-center justify-center rounded-field bg-brand text-[16px] font-semibold leading-6 text-ink-on-brand transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:w-submit"
      >
        {t.web.home.hero.submit}
      </button>
    </form>
  );
}

/** Ячейка панели: радиус 14, паддинг 8/20, просвет «подпись → значение» 2
 * (узлы 3253:37, 3253:41, 3253:45, 3253:49). */
function Field({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-0.5 rounded-field px-field-x py-field-y", className)}>
      {children}
    </div>
  );
}

/** Разделитель 1×72 — во всю высоту панели (узел 3253:40). На узком экране
 * поля стоят друг под другом, и вертикальная черта между ними бессмысленна. */
function Divider() {
  return <span aria-hidden="true" className="hidden w-px self-stretch bg-line-strong lg:block" />;
}

/**
 * Оболочка попапа: белая подложка с той же тенью, что у самой панели поиска
 * (`shadow-panel`, узел 3253:36 — переиспользован, а не придуман заново),
 * радиус 20 (`rounded-panel`, тот же токен, что у панели). Позиционирование
 * `absolute` под полем; ширина по умолчанию под календарь (280 + паддинг),
 * `className` сужает под время/гостей. `max-w-[calc(100vw-32px)]` не даёт
 * попапу вылезти за экран 360 px.
 */
function Popover({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        // Центр под полем, а не левый край: на 360 px левый край поля уже
        // близко к краю экрана (паддинги контейнера + панели), и попап
        // фиксированной ширины, прижатый левым краем к полю, вылезал бы за
        // правую границу. Центрирование распределяет риск на обе стороны;
        // `max-w` дополнительно не даёт попапу быть шире экрана.
        "absolute left-1/2 top-full z-20 mt-2 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-panel border border-line-control bg-canvas p-4 shadow-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}
