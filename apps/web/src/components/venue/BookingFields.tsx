"use client";

import type { MouseEvent, ReactNode } from "react";

import { GUEST_OPTIONS } from "@web/lib/booking-options";
import { cx } from "@web/lib/cx";
import { useLocale } from "@web/lib/locale";

/**
 * Поля выбора дня и компании. Нужны ДВУМ экранам — карточке брони в правой
 * колонке заведения (узел 3525:14731) и странице бронирования (3525:14815),
 * поэтому лежат отдельно: вторая копия поля даты разъехалась бы с первой в
 * первую же правку.
 */

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
   * пятницу, гость больше не смог бы вернуться на четверг. */
  min: string | null;
  label: string;
  shown: string | null;
  /** Запрос в полёте — бронь на странице бронирования или доступность в
   * карточке заведения: менять день нельзя. */
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <FieldShell label={label} htmlFor={id}>
      <div className="grid min-w-0 flex-1">
        <input
          id={id}
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

/**
 * Дата СТРОКОЙ ЗАГОЛОВКА — «Вторник, 25 августа» на странице бронирования
 * (узел 3525:14826). В макете это просто текст: выбрать другой день негде.
 * Здесь текст остаётся тем же 16/24 SemiBold, но под ним лежит настоящее
 * `input[type=date]` — тот же приём с прозрачным значением, что у `DateField`,
 * без рамки поля. Значок календаря справа говорит, что строка нажимается:
 * иначе она неотличима от заголовка.
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
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="grid min-w-0">
        <input
          id={id}
          type="date"
          value={value ?? ""}
          min={min ?? undefined}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onClick={openPicker}
          className="search-native-picker peer col-start-1 row-start-1 w-full cursor-pointer rounded-sm bg-transparent text-flow-row-title text-transparent outline-none focus:text-ink disabled:cursor-not-allowed"
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

/**
 * Открыть родной календарь кликом по ЛЮБОМУ месту поля: штатно это делает
 * только кнопка справа, а её мы прячем — в макете её нет.
 */
export function openPicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // Браузер отказался — поле по-прежнему редактируется с клавиатуры.
  }
}
