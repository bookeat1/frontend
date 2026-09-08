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
 *
 * ДВА РАЗМЕРА, ПОТОМУ ЧТО В МАКЕТЕ ИХ ДВА, и они не сводятся друг к другу:
 *
 *   `m`    — чип фильтра кита (узлы 3274:22/24/26): 38 высотой, паддинг 9/16,
 *            кегль 14/20 Medium, обводка есть ВСЕГДА, даже у невыбранного;
 *   `wish` — чип быстрого пожелания на странице бронирования (узлы
 *            3525:14930…14938): 34 высотой, паддинг 8/14, кегль 13/18 Medium,
 *            у невыбранного обводки НЕТ вовсе, а подложка `background/subtle`.
 *
 * Ни одно число из четырёх пар не совпадает, усреднение не попадает ни в один
 * узел, а `className` снаружи здесь ненадёжен: у двух утилит одного свойства
 * одинаковая специфичность, и побеждает та, что Tailwind сгенерировал позже.
 */
export type ChipState = "default" | "active" | "selected";
export type ChipSize = "m" | "wish";

export interface ChipProps {
  children: ReactNode;
  state?: ChipState;
  /** `m` — кит (3274:22), `wish` — пожелания к брони (3525:14930). */
  size?: ChipSize;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizes: Record<ChipSize, string> = {
  m: "h-chip px-chip-x text-[14px] leading-5",
  wish: "h-flow-wish px-flow-wish-x text-flow-wish",
};

/** Покой у двух размеров нарисован по-разному вплоть до наличия обводки,
 * поэтому таблица одна на пару «размер × состояние». Выбранные состояния
 * совпадают, но повторены явно: одинаковыми они быть не обязаны. */
const looks: Record<ChipSize, Record<ChipState, string>> = {
  m: {
    default: "bg-canvas text-ink-secondary border-line-control",
    active: "bg-brand-subtle text-brand-text border-brand",
    selected: "bg-brand text-ink-on-brand border-brand",
  },
  wish: {
    default: "bg-subtle text-ink-secondary border-transparent",
    active: "bg-brand-subtle text-brand-text border-brand",
    selected: "bg-brand text-ink-on-brand border-brand",
  },
};

export function Chip({
  children,
  state = "default",
  size = "m",
  disabled = false,
  onClick,
  className,
}: ChipProps) {
  return (
    <button
      type="button"
      // `default` — единственное ненажатое состояние; `active` в макете это
      // выбранный фильтр в светлом исполнении, и для скринридера он нажат.
      aria-pressed={state !== "default"}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "border font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled disabled:text-ink-disabled",
        sizes[size],
        looks[size][state],
        className,
      )}
    >
      {children}
    </button>
  );
}
