"use client";

import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Степпер количества — карточка блюда в «Популярное в меню» (`/venues/[id]`)
 * и строка предзаказа в сводке брони (`/venues/[id]/book`).
 * `venue-menu-stepper-promo-card` (2026-09-06), задачи A-WEB-2/A-WEB-3.
 *
 * ДВА СОСТОЯНИЯ (A2): `quantity === 0` — одиночная круглая кнопка «+»
 * (`aria-label` «Добавить {name}»); `quantity > 0` — пилюля «− N +».
 * «+» неактивна на потолке (`aria-disabled`, A3); клик/Enter/Space её не
 * двигают — `onIncrement` просто не зовётся выше потолка.
 *
 * НЕСВЕРЕННЫЕ ЗНАЧЕНИЯ: узел карточки степпера Figma 3525:14646 не отдался
 * REST'ом (429) ни в сессии черновика ТЗ, ни в этой — см. раздел 6 спеки
 * `venue-menu-stepper-promo-card` и `conventions/bookeat-mobile-figma-access.md`.
 * Размеры кнопок и пилюли — из масштаба уже сверенных токенов страницы
 * заведения (радиус карточки блюда 16, кегль тела 13-16), а не измерены по
 * макету; поведенческие критерии (A2-A4) сверены по спеке.
 */
export function DishStepper({
  quantity,
  max,
  dishName,
  size = "m",
  onAdd,
  onIncrement,
  onDecrement,
}: {
  quantity: number;
  max: number;
  dishName: string;
  /** "m" — компактная (карточка блюда), "l" — строка сводки брони. */
  size?: "m" | "l";
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const t = useT();
  const outerDim = size === "l" ? "h-9 w-9" : "h-8 w-8";
  const pillHeight = size === "l" ? "h-9" : "h-8";
  const glyphSize = size === "l" ? 16 : 14;

  if (quantity <= 0) {
    return (
      <button
        type="button"
        aria-label={t.web.venue.menu.addDish(dishName)}
        onClick={onAdd}
        className={cx(
          outerDim,
          "flex shrink-0 items-center justify-center rounded-full bg-brand text-ink-on-brand transition-colors hover:bg-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        )}
      >
        <PlusGlyph size={glyphSize} />
      </button>
    );
  }

  const atMax = quantity >= max;

  return (
    <div
      className={cx(
        pillHeight,
        "flex shrink-0 items-center gap-2 rounded-full bg-brand px-1.5 text-ink-on-brand",
      )}
    >
      <button
        type="button"
        aria-label={t.web.venue.menu.qtyLess}
        onClick={onDecrement}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <MinusGlyph size={glyphSize} />
      </button>
      <span className="min-w-[14px] text-center text-[14px] font-semibold leading-5 tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={t.web.venue.menu.qtyMore}
        aria-disabled={atMax}
        onClick={() => {
          if (!atMax) onIncrement();
        }}
        className={cx(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          atMax ? "opacity-40" : "hover:bg-brand-text",
        )}
      >
        <PlusGlyph size={glyphSize} />
      </button>
    </div>
  );
}

function PlusGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function MinusGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
