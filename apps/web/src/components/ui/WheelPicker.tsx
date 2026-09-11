"use client";

import { Fragment } from "react";

import { cx } from "@web/lib/cx";

/**
 * Одна колонка «колеса»: часы, минуты панели поиска или число гостей.
 *
 * Узел задачи «виджет выбора даты/времени/гостей» (Figma `qmMsg4jO1ggmyEHNIAD2ll`,
 * `5178:19076` «select_hour_desktop» — часы+минуты, `5178:19173` — тот же
 * компонент с одной колонкой для гостей) снят ЧЕРЕЗ DesignAgent-мост
 * скриншотами, а не через REST: `/v1/files/:key/nodes` и `/v1/images` для
 * этого файла второй раз подряд ответили 429 (см. `retry-after` ~11.5 часа,
 * проверено 2026-09-11 в этой самой задаче — тот же файл, что и в первом
 * заходе на панель, см. комментарий `Calendar.tsx`). По снимку видно
 * механику (шеврон вверх/вниз листает значение на ±1, зациклено — после 23
 * часов 00, после 59 минут 00 и т.д.; текущее значение — крупное белое число
 * на сплошном тёмно-красном круге, соседние — серым мельче) и что ОБА узла —
 * один переиспользуемый компонент, различаются числом колонок и диапазоном.
 * Числа геометрии здесь — переиспользованные Figma-сверенные токены ИЗ
 * ДРУГИХ мест этого приложения (кружок выбора — `h-9 w-9 rounded-full
 * bg-brand text-ink-on-brand`, тот же, что у выбранного дня `Calendar.tsx` и
 * у выбранного `TimeSlot`; кнопки-шевроны — `h-8 w-8 rounded-full
 * hover:bg-subtle`, тот же класс, что у стрелок месяца календаря; сама
 * стрелка — путь `ChevronIcon` из `SelectField.tsx`), а не подобраны на глаз.
 */
export interface WheelColumnConfig {
  /** Текущее значение колонки. */
  value: number;
  min: number;
  max: number;
  /** Шаг перебора значений; по умолчанию 1. */
  step?: number;
  /** Как напечатать число — «07» для часов/минут, «2» для гостей. */
  format: (value: number) => string;
  /** Название колонки для лейблов accessibility — «Часы», «Минуты», «Гости». */
  label: string;
  /** Текст `aria-label` кнопки-шеврона «вверх» (следующее значение). */
  incrementLabel: string;
  /** Текст `aria-label` кнопки-шеврона «вниз» (предыдущее значение). */
  decrementLabel: string;
  onChange: (value: number) => void;
}

/**
 * Переиспользуемое «колесо со стрелками»: один пропущенный компонент вместо
 * двух почти одинаковых — раньше время панели поиска было списком получасовых
 * слотов, а гости степпером `−`/`+`; оба узла макета оказались одним и тем же
 * компонентом кита, значит и в коде должен быть один компонент, а не пара.
 *
 * `columns.length === 1` — гости; `columns.length === 2` — часы и минуты
 * (с разделителем между ними, тот же `bg-line-strong`, что у разделителей
 * самой панели поиска).
 */
export function WheelPicker({
  columns,
  className,
}: {
  columns: WheelColumnConfig[];
  className?: string;
}) {
  return (
    <div className={cx("flex items-stretch justify-center gap-1", className)}>
      {columns.map((column, index) => (
        <Fragment key={column.label}>
          {index > 0 ? <span aria-hidden="true" className="mx-2 w-px self-stretch bg-line-strong" /> : null}
          <WheelColumn config={column} />
        </Fragment>
      ))}
    </div>
  );
}

/** Пять видимых строк колонки: текущее значение ±2 шага, зациклено. */
const ROW_OFFSETS = [-2, -1, 0, 1, 2] as const;

function WheelColumn({ config }: { config: WheelColumnConfig }) {
  const { value, min, max, step = 1, format, label, incrementLabel, decrementLabel, onChange } = config;

  return (
    <div className="flex flex-col items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={incrementLabel}
        onClick={() => onChange(cycleValue(value + step, min, max, step))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ChevronIcon direction="up" />
      </button>

      <div className="flex flex-col items-center">
        {ROW_OFFSETS.map((offset) => {
          const rowValue = cycleValue(value + offset * step, min, max, step);
          if (offset === 0) {
            return (
              <output
                key="selected"
                aria-live="polite"
                aria-label={`${label}: ${format(rowValue)}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[16px] font-semibold leading-5 text-ink-on-brand"
              >
                {format(rowValue)}
              </output>
            );
          }
          const distance = Math.abs(offset);
          return (
            <button
              key={offset}
              type="button"
              aria-label={`${label}: ${format(rowValue)}`}
              onClick={() => onChange(rowValue)}
              className={cx(
                "flex h-8 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                distance === 1
                  ? "text-[14px] font-medium leading-5 text-ink-secondary"
                  : "text-[13px] font-normal leading-4 text-ink-tertiary",
              )}
            >
              {format(rowValue)}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label={decrementLabel}
        onClick={() => onChange(cycleValue(value - step, min, max, step))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ChevronIcon direction="down" />
      </button>
    </div>
  );
}

/**
 * Зацикленный шаг: 23 часа + 1 → 0, 0 часов − 1 → 23 (то же для минут 0…59 и
 * гостей `GUEST_OPTIONS`). Округление индекса нужно, чтобы плавающая точка
 * шага не увела значение мимо решётки — на практике `step` всегда 1, но
 * компонент не завязан на это числом.
 */
function cycleValue(raw: number, min: number, max: number, step: number): number {
  const count = Math.floor((max - min) / step) + 1;
  const index = Math.round((raw - min) / step);
  const wrapped = ((index % count) + count) % count;
  return min + wrapped * step;
}

/** Тот же путь стрелки, что у `SelectField.tsx` — «вниз» как есть, «вверх»
 * повёрнута на 180°. Романтической точности эта форма не требует: это
 * системный шеврон кита, не фирменная иконка. */
function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cx("shrink-0", direction === "up" && "rotate-180")}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
