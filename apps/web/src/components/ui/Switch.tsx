"use client";

import { cx } from "@web/lib/cx";

/**
 * Переключатель «вкл/выкл» — узел 5115:9023 («Настройки» → «Уведомления»).
 *
 * 44×24 трек (`w-11 h-6`), ползунок 20 (`w-5 h-5`) с отступом 2 с каждой
 * стороны — числа подтверждены пиксельным замером экспортированного PNG
 * (`webProfile.settings.toggle`, `packages/design-tokens/src/web.ts`).
 * Заливка «включено» — `bg-toggle-on` (#18A957, свой токен, НЕ `success500`
 * бейджа брони — цвета в макете разные).
 *
 * Настоящий `<button role="switch">`, а не чекбокс под стилем: клавиатура и
 * скринридер получают состояние через `aria-checked`, а не через CSS.
 */
export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled = false, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        checked ? "bg-toggle-on" : "bg-disabled",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-canvas shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
