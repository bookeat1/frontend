"use client";

import { useRef, useState, type ReactNode } from "react";

import { Calendar } from "@web/components/ui/Calendar";
import { Popover } from "@web/components/ui/Popover";
import { GUEST_OPTIONS } from "@web/lib/booking-options";
import { cx } from "@web/lib/cx";
import { useLocale } from "@web/lib/locale";
import { useDismissable } from "@web/lib/use-dismissable";

/**
 * Поля выбора дня и компании. Нужны ДВУМ экранам — карточке брони в правой
 * колонке заведения (узел 3525:14731) и странице бронирования (3525:14815),
 * поэтому лежат отдельно: вторая копия поля даты разъехалась бы с первой в
 * первую же правку.
 */

/**
 * Поле «Дата» (узлы 3525:14736…14740) карточки «Забронировать столик».
 *
 * ДО 2026-09-14 клик открывал НАСТОЯЩИЙ `showPicker()` — родной календарь
 * браузера (на английском, «September 2026», M T W T F S S), а не кит
 * заведения. Владелец заметил расхождение со скриншотом: панель поиска
 * (`SearchPanel`) к этому моменту уже показывала свой попап `Calendar`, а
 * карточка брони — нет, хотя сам `Calendar` изначально писался под ОБА места
 * (см. его комментарий). Фикс — тот же приём, что в панели поиска: клик по
 * полю открывает попап `Calendar` (свой, на языке интерфейса), нативный
 * `input[type=date]` остаётся ТОЛЬКО для клавиатурного ввода и получает
 * `pointer-events-none`, чтобы мышь до него не долетала и `showPicker()`
 * браузера было нечем вызвать. Подпись связана через `aria-labelledby`, а не
 * `<label htmlFor>`: клик по `<label for=…>` на date-поле форвардит
 * «настоящую» активацию в обход `pointer-events-none` (та же ловушка, что в
 * `bookeat-web-double-datepicker`).
 *
 * Печатает нативное поле значение в формате БРАУЗЕРА («mm/dd/yyyy»), а в
 * макете — «25 августа», поэтому свой текст лежит поверх прозрачного
 * значения инпута, в фокусе показывается родное содержимое (иначе гость
 * правил бы невидимые для себя цифры).
 */
export function DateField({
  id,
  value,
  min,
  label,
  shown,
  disabled,
  onChange,
}: {
  id: string;
  value: string | null;
  /** Нижняя граница календаря — СЕГОДНЯ, а не выбранный день: иначе, выбрав
   * пятницу, гость больше не смог бы вернуться на четверг. Тот же день
   * подставляется попапу как «сегодня» для подсветки (см. `today={min}`
   * ниже) — оба параметра здесь всегда одно и то же значение. */
  min: string | null;
  label: string;
  shown: string | null;
  /** Запрос в полёте — бронь на странице бронирования или доступность в
   * карточке заведения: менять день нельзя. */
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const labelId = `${id}-label`;

  useDismissable(open, fieldRef, () => setOpen(false));

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div ref={fieldRef} className="relative min-w-0 flex-1">
      <FieldShell
        label={label}
        labelId={labelId}
        onClick={disabled ? undefined : () => setOpen((current) => !current)}
      >
        <div className="grid min-w-0 flex-1">
          <input
            id={id}
            type="date"
            aria-labelledby={labelId}
            value={value ?? ""}
            min={min ?? undefined}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="search-native-picker peer pointer-events-none col-start-1 row-start-1 w-full bg-transparent text-booking-value text-transparent outline-none focus:text-ink"
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
      {open ? (
        <Popover align="start" className="p-4">
          <Calendar value={value} min={min} today={min} onSelect={pick} />
        </Popover>
      ) : null}
    </div>
  );
}

/**
 * Дата СТРОКОЙ ЗАГОЛОВКА — «Вторник, 25 августа» на странице бронирования
 * (узел 3525:14826). В макете это просто текст: выбрать другой день негде.
 *
 * ДО 2026-09-14 клик по строке звал `showPicker()` — родной английский
 * календарь браузера, тот же дефект, что чинили в `DateField` (см. его
 * комментарий). Фикс — тот же приём: клик по строке открывает попап
 * `Calendar`, нативный `input[type=date]` остаётся ТОЛЬКО для клавиатурного
 * ввода и получает `pointer-events-none`. Подпись связана через
 * `aria-labelledby` (видимого текста подписи нет — её роль играет сама дата),
 * а не `<label htmlFor>` по той же причине, что у `DateField`.
 */
export function InlineDateField({
  id,
  value,
  min,
  label,
  shown,
  disabled,
  onChange,
}: {
  id: string;
  value: string | null;
  min: string | null;
  /** Подпись для диктора — визуально её нет, текстом служит сама дата. */
  label: string;
  shown: string | null;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const labelId = `${id}-label`;

  useDismissable(open, fieldRef, () => setOpen(false));

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div ref={fieldRef} className="relative min-w-0">
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <div
        onClick={disabled ? undefined : () => setOpen((current) => !current)}
        className={cx("flex min-w-0 items-center gap-2", disabled ? undefined : "cursor-pointer")}
      >
        <div className="grid min-w-0">
          <input
            id={id}
            type="date"
            aria-labelledby={labelId}
            value={value ?? ""}
            min={min ?? undefined}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="search-native-picker peer pointer-events-none col-start-1 row-start-1 w-full bg-transparent text-flow-row-title text-transparent outline-none focus:text-ink disabled:cursor-not-allowed"
          />
          <span
            aria-hidden="true"
            className={cx(
              "pointer-events-none col-start-1 row-start-1 self-center truncate text-flow-row-title peer-focus:invisible",
              disabled ? "text-ink-disabled" : "text-ink",
            )}
          >
            {shown ?? ""}
          </span>
        </div>
        <ChevronDown />
      </div>
      {open ? (
        <Popover align="start" className="p-4">
          <Calendar value={value} min={min} today={min} onSelect={pick} />
        </Popover>
      ) : null}
    </div>
  );
}

/** Поле «Гости» (узлы 3525:14741…14745). Родной `select`: его список умеет
 * открывать клавиатура, и он же печатает «2 гостя» сам — своей подписи
 * поверх, в отличие от даты, не требуется. */
export function GuestsField({
  id,
  value,
  label,
  disabled,
  onChange,
}: {
  id: string;
  value: number;
  label: string;
  /** Запрос в полёте — бронь на странице бронирования или доступность в
   * карточке заведения: менять компанию нельзя. */
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const { t } = useLocale();
  return (
    <FieldShell label={label} htmlFor={id}>
      <select
        id={id}
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
 * паддингом 14/12 и значком 24 справа (узлы 3525:14737 и 3525:14738).
 *
 * Два способа связать подпись с полем: `htmlFor` (родной `<select>` у
 * `GuestsField` — простая связка) или `labelId` + `onClick` (`DateField`,
 * попап которого открывается кликом по всей рамке, а не по нативному
 * `input`, — см. его комментарий про `aria-labelledby`). */
function FieldShell({
  label,
  htmlFor,
  labelId,
  onClick,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "flex min-w-0 flex-1 flex-col gap-1.5",
        onClick ? "cursor-pointer" : undefined,
      )}
    >
      <label id={labelId} className="text-booking-label text-ink-secondary" htmlFor={htmlFor}>
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
