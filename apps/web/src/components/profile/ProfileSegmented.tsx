"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";

import { cx } from "@web/lib/cx";

/**
 * Сегмент-контрол страницы гостя — узел 3525:15197: подложка `background/muted`
 * радиуса 12 с паддингом 4, сегмент 36 высотой, паддинг 16, радиус 9, 14/20.
 * Выбранный — белый с тенью контрола и SemiBold, остальные — `text/tertiary`
 * Medium. Все числа — `webProfile.segmented`, в классах ни одного своего.
 *
 * Семантика — вкладки (`tablist`/`tab`): сегменты переключают содержимое
 * одного раздела, а не уводят на другую страницу. Стрелки ←/→ ходят по
 * сегментам, Home/End — к крайним; фокус держит только выбранный
 * (`tabIndex=-1` у остальных), как положено в паттерне tabs.
 *
 * На 360 три подписи со счётчиками шире контейнера (422 против 328) — ряд
 * ПРОКРУЧИВАЕТСЯ, а не ужимается: правило горизонтальных рядов сайта.
 */
export interface SegmentOption<K extends string> {
  key: K;
  label: string;
}

/** `id` вкладки: панель ссылается на выбранную через `aria-labelledby`. */
export function segmentTabId(panelId: string, key: string): string {
  return `${panelId}-tab-${key}`;
}

export interface ProfileSegmentedProps<K extends string> {
  options: readonly SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Подпись группы для читалки — например «Фильтр броней». */
  label: string;
  /** `id` панели, которой управляет выбранный сегмент. */
  panelId?: string;
  className?: string;
}

export function ProfileSegmented<K extends string>({
  options,
  value,
  onChange,
  label,
  panelId,
  className,
}: ProfileSegmentedProps<K>) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusAndSelect = (index: number) => {
    const next = options[(index + options.length) % options.length];
    if (!next) return;
    onChange(next.key);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[
      (index + options.length) % options.length
    ]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.findIndex((option) => option.key === value);
    if (event.key === "ArrowRight") focusAndSelect(current + 1);
    else if (event.key === "ArrowLeft") focusAndSelect(current - 1);
    else if (event.key === "Home") focusAndSelect(0);
    else if (event.key === "End") focusAndSelect(options.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx(
        "row-scrollbar inline-flex max-w-full overflow-x-auto overscroll-x-contain rounded-md bg-muted p-segmented-p",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            id={panelId ? segmentTabId(panelId, option.key) : undefined}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.key)}
            className={cx(
              "inline-flex h-segment shrink-0 items-center justify-center whitespace-nowrap rounded-segment px-segment-x text-segment transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              selected
                ? "bg-canvas font-semibold text-ink shadow-control"
                : "text-ink-tertiary hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
