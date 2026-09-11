"use client";

import { useMemo, useState } from "react";

import { cx } from "@web/lib/cx";
import { calendarMonthLabel, calendarWeekdayLabels } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";

/**
 * Сетка месяца для попапа «Дата» панели поиска и карточки брони.
 *
 * НЕ СВЕРЕНО С МАКЕТОМ: три узла задачи (Figma `qmMsg4jO1ggmyEHNIAD2ll`,
 * `5177:12242`/`5178:19076`/`5178:19173`) не отдались — и `/v1/files/:key`,
 * и `/v1/images` ответили 429 с `retry-after` ~14 часов в момент работы
 * (файл тронут в это же утро, окно 429 открытое не проверялось повторно).
 * Поэтому геометрия и цвета здесь — НЕ подобранные на глаз произвольные
 * числа, а переиспользованные токены из уже сверенных по Figma мест того же
 * приложения: ячейка `h-9 w-9` — тот же квадрат, что кнопки степпера гостей
 * (`webBookingFlow`, узел 3525:14870), заливка выбранного дня и текст на ней
 * — те же `bg-brand`/`text-ink-on-brand`, что у кнопки «Найти» панели поиска
 * и у выбранного слота времени (`TimeSlot`, узел 3z0f…:3274:33). Значения
 * нужно свериться, когда откроется лимит Figma REST — до тех пор это
 * ПОВЕДЕНИЕ (календарь работает и невозможно выбрать прошедший день), а не
 * подтверждённая раскладка.
 */
export function Calendar({
  value,
  min,
  today,
  onSelect,
}: {
  /** Выбранный день, ISO `YYYY-MM-DD`, или `null`. */
  value: string | null;
  /** Нижняя граница — обычно сегодня: выбрать вчера нельзя. */
  min: string | null;
  /**
   * Сегодняшний день ISO, посчитанный РОДИТЕЛЕМ после гидратации (тот же
   * приём, что у `SearchPanel`/`WhenCard`: «сегодня» знает только браузер, а
   * посчитанное во время рендера на сервере значение разошлось бы с
   * браузерным). Пока `null` — подсветки «сегодня» просто нет, календарь всё
   * равно рисуется и работает.
   */
  today: string | null;
  onSelect: (iso: string) => void;
}) {
  const { locale, t } = useLocale();
  const initial = parseIso(value) ?? parseIso(min) ?? parseIso(today) ?? new Date();
  const [cursor, setCursor] = useState({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() });

  const weekdayLabels = useMemo(() => calendarWeekdayLabels(locale), [locale]);
  const minDate = useMemo(() => parseIso(min), [min]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, today),
    [cursor.year, cursor.month, today],
  );

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  const canGoBack = !minDate || cursor.year > minDate.getFullYear() || cursor.month > minDate.getMonth();

  return (
    <div className="w-[280px]">
      <div className="flex items-center justify-between px-1 pb-3">
        <button
          type="button"
          aria-label={t.web.home.hero.calendarPrevMonth}
          disabled={!canGoBack}
          onClick={() => shiftMonth(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:text-ink-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ‹
        </button>
        <p className="text-[15px] font-semibold leading-5 text-ink">
          {calendarMonthLabel(cursor.year, cursor.month, locale)}
        </p>
        <button
          type="button"
          aria-label={t.web.home.hero.calendarNextMonth}
          onClick={() => shiftMonth(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 px-1">
        {weekdayLabels.map((label, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="flex h-8 items-center justify-center text-[12px] font-medium leading-4 text-ink-tertiary"
          >
            {label}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <span key={index} />;
          const disabled = Boolean(minDate) && cell.iso < (min as string);
          const selected = cell.iso === value;
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={cell.iso}
              onClick={() => onSelect(cell.iso)}
              className={cx(
                "flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-medium leading-5 transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                disabled
                  ? "cursor-not-allowed text-ink-disabled"
                  : selected
                    ? "bg-brand text-ink-on-brand"
                    : cell.isToday
                      ? "border border-brand text-brand-text hover:bg-subtle"
                      : "text-ink hover:bg-subtle",
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DayCell {
  iso: string;
  day: number;
  isToday: boolean;
}

/** Сетка на 6 недель, понедельник первым; ячейки вне месяца — `null`. */
function buildMonthGrid(year: number, month: number, today: string | null): (DayCell | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=Sun
  const leadingBlanks = (firstWeekday + 6) % 7; // сдвиг на понедельник
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (DayCell | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = isoOf(new Date(Date.UTC(year, month, day)));
    cells.push({ iso, day, isToday: iso === today });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoOf(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}
