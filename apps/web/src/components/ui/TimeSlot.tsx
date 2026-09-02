"use client";

import { cx } from "@web/lib/cx";

/**
 * Слот времени.
 *
 * Отдельный компонент, а не вариант `Chip`: другой радиус (у чипа полный),
 * другой кегль и другая семантика — чип это фильтр, который можно снять, слот
 * это выбор одного значения из ряда.
 *
 * Занятое время приходит с бэкенда как недоступное, поэтому `disabled` —
 * настоящий атрибут кнопки, а не серый цвет: клавиатура такой слот пропускает,
 * мышь по нему не срабатывает.
 *
 * ДВА РАЗМЕРА, ПОТОМУ ЧТО ИХ ДВА В МАКЕТЕ, а не потому что «где-то не влезло»:
 *
 *   • `m` — слот кита, Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3274:29/31/33:
 *     42 высотой, паддинг 11/20, радиус 12, кегль 15/20 SemiBold, обводка
 *     #B2B2B2, выбранный залит фирменным цветом;
 *   • `grid` — ячейка сетки свободного времени в карточке брони, Figma
 *     QovvuAoI9YxsLMwWkfgKN8, узлы 3525:14751/14760: 40 высотой, радиус 10,
 *     кегль 14/20 SemiBold, БЕЗ обводки, заливка `background/subtle`, а
 *     выбранный — светлый `brand/50` с фирменным ТЕКСТОМ.
 *
 * Числа разные во всех парах, усреднение не попадает ни в один узел. Второй
 * компонент завёл бы вторую правду о слоте; `className` снаружи ненадёжен —
 * у двух утилит одного свойства одинаковая специфичность, и побеждает та, что
 * сгенерирована позже.
 */
export interface TimeSlotProps {
  /** Подпись слота, например "19:30". Формат приходит с сервера. */
  time: string;
  selected?: boolean;
  disabled?: boolean;
  size?: "m" | "grid";
  /** Что читает экранный диктор вместо голого «19:30»: у недоступного слота
   * туда уходит причина отказа, иначе кнопка озвучивается как обычная. */
  label?: string;
  onSelect?: (time: string) => void;
  className?: string;
}

const sizes = {
  m: "h-slot px-slot-x rounded-md border text-[15px] font-semibold leading-5",
  grid: "h-slot-grid w-full rounded-slot-grid text-booking-slot",
} as const;

/** Покой, выбор и отказ у двух размеров нарисованы по-разному — вплоть до
 * наличия обводки, поэтому таблица одна на пару «размер × состояние». */
const looks = {
  m: {
    idle: "border-line-control bg-canvas text-ink hover:bg-subtle",
    selected: "border-brand bg-brand text-ink-on-brand",
    disabled: "disabled:border-transparent disabled:bg-disabled disabled:text-ink-disabled",
  },
  grid: {
    idle: "bg-subtle text-ink hover:bg-muted",
    selected: "bg-brand-subtle text-brand-text",
    disabled: "disabled:bg-disabled disabled:text-ink-disabled",
  },
} as const;

export function TimeSlot({
  time,
  selected = false,
  disabled = false,
  size = "m",
  label,
  onSelect,
  className,
}: TimeSlotProps) {
  const look = looks[size];
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={() => onSelect?.(time)}
      className={cx(
        "inline-flex shrink-0 items-center justify-center transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed",
        sizes[size],
        selected ? look.selected : look.idle,
        look.disabled,
        className,
      )}
    >
      {time}
    </button>
  );
}
