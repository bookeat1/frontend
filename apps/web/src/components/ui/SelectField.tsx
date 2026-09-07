"use client";

import { useId, type ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Выпадающий список с подписью — визуально та же коробка, что у `TextField`
 * (размер `m`: высота `h-input` 48, радиус `rounded-md` 12, рамка
 * `border-line-control`), только со стрелкой справа вместо текстового ввода.
 * Использован в «Настройках» → «Язык и город» (узел 5115:9023).
 *
 * Обычный `<select>`, а не своя выпадашка — та же причина, что у выбора
 * города в шапке (`SiteHeader.tsx`): короткий список, бесплатная клавиатура
 * и системный список на любом устройстве.
 */
export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  /** Строка под полем, когда список не загрузился — не `error` красным: это
   * не ошибка ввода гостя, а сбой запроса, поле остаётся синим/серым. */
  hint?: string;
  className?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
  hint,
  className,
}: SelectFieldProps<T>) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={cx("flex w-full flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium leading-[18px] text-ink-secondary">
        {label}
      </label>
      <div
        className={cx(
          "flex h-input items-center gap-3 rounded-md border border-line-control bg-canvas px-input-x",
          "focus-within:border-brand focus-within:ring-1 focus-within:ring-inset focus-within:ring-brand",
          disabled && "opacity-60",
        )}
      >
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.value as T)}
          className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-[15px] font-medium leading-[22px] text-ink outline-none disabled:cursor-not-allowed disabled:text-ink-disabled"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
      {hint ? (
        <p id={hintId} className="text-[13px] leading-[18px] text-ink-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ChevronIcon(): ReactNode {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-ink-tertiary"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
