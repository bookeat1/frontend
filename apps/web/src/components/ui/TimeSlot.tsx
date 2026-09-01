"use client";

import { cx } from "@web/lib/cx";

/**
 * Слот времени. Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3274:29 / 3274:31 /
 * 3274:33 — высота 42, паддинг 11/20, радиус 12, кегль 15/20 SemiBold.
 *
 * Отдельный компонент, а не вариант `Chip`: другой радиус (12 против
 * полного), другой кегль и другая семантика — чип это фильтр,
 * который можно снять, слот это выбор одного значения из ряда.
 *
 * Занятое время приходит с бэкенда как недоступное, поэтому `disabled` —
 * настоящий атрибут кнопки, а не серый цвет: клавиатура такой слот пропускает,
 * мышь по нему не срабатывает.
 */
export interface TimeSlotProps {
  /** Подпись слота, например "19:30". Формат приходит с сервера. */
  time: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (time: string) => void;
  className?: string;
}

export function TimeSlot({ time, selected = false, disabled = false, onSelect, className }: TimeSlotProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect?.(time)}
      className={cx(
        "inline-flex h-slot shrink-0 items-center justify-center rounded-md px-slot-x",
        "border text-[15px] font-semibold leading-5 transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled disabled:text-ink-disabled",
        selected
          ? "border-brand bg-brand text-ink-on-brand"
          : "border-line-control bg-canvas text-ink hover:bg-subtle",
        className,
      )}
    >
      {time}
    </button>
  );
}
