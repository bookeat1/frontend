"use client";

import type { ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Чип фильтра. Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3274:22 / 3274:24 /
 * 3274:26 — высота 38, паддинг 9/16, радиус полный, кегль 14/20 Medium.
 *
 * В макете нарисованы ТРИ состояния, и они не сводятся к паре
 * «выбран/не выбран»:
 *   • default — белый фон, обводка #B2B2B2, текст #595959;
 *   • active  — светло-фирменная заливка #FBEFF0, обводка #B33036,
 *               текст #96272C;
 *   • selected — сплошная заливка #B33036, белый текст.
 * Поэтому проп называется `state`, а не `selected`: булев флаг третье
 * состояние выразить не может, и его пришлось бы «дорисовывать» на месте.
 *
 * Это настоящая <button> с `aria-pressed` — переключатель, а не ссылка:
 * скринридер должен объявлять, нажат чип или нет.
 */
export type ChipState = "default" | "active" | "selected";

export interface ChipProps {
  children: ReactNode;
  state?: ChipState;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const states: Record<ChipState, string> = {
  default: "bg-canvas text-ink-secondary border-line-control",
  active: "bg-brand-subtle text-brand-text border-brand",
  selected: "bg-brand text-ink-on-brand border-brand",
};

export function Chip({ children, state = "default", disabled = false, onClick, className }: ChipProps) {
  return (
    <button
      type="button"
      // `default` — единственное ненажатое состояние; `active` в макете это
      // выбранный фильтр в светлом исполнении, и для скринридера он нажат.
      aria-pressed={state !== "default"}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex h-chip shrink-0 items-center justify-center rounded-full px-chip-x",
        "border text-[14px] font-medium leading-5 transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled disabled:text-ink-disabled",
        states[state],
        className,
      )}
    >
      {children}
    </button>
  );
}
