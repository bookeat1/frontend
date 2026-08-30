"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";

import { cx } from "@web/lib/cx";
import { t } from "@web/lib/i18n";

/**
 * Модальное окно. Figma 3z0f6dgev4HMwBAHPjTjPo, узел 3272:6 (вход и
 * регистрация): ширина 380, радиус 24, паддинг 32, просвет 20, тень
 * 0 20 50 rgba(0,0,0,.32); затемнение под окном — заливка кадра 3272:2,
 * rgba(27,27,27,.72). Заголовок 26/34 Bold, подпись 15/22 Regular #595959.
 *
 * Что здесь есть кроме разметки:
 *   • Esc закрывает;
 *   • клик по затемнению закрывает, но только если нажатие НАЧАЛОСЬ на нём —
 *     иначе выделение текста мышью, отпущенное за краем окна, закрывало бы
 *     диалог вместе с введёнными данными;
 *   • фокус уезжает внутрь при открытии и возвращается туда, откуда пришёл;
 *   • Tab заперт внутри окна — иначе клавиатура уходит на страницу под
 *     затемнением, где ничего не видно;
 *   • страница под окном не прокручивается.
 *
 * Ширина 380 — максимум, а не фиксатор: на 360 px окно ужимается вместе с
 * полями, а не выпирает за экран.
 */
export interface ModalProps {
  title: string;
  /** Подпись под заголовком (узел 3272:10). */
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, description, onClose, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const pressedOnScrim = useRef(false);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  const focusable = useCallback(
    () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    [],
  );

  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    // Первым делом фокус на само окно: если внутри есть поле, гость сразу
    // начнёт печатать; если полей нет — Tab всё равно останется внутри.
    (focusable()[0] ?? dialogRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreTo?.focus();
    };
  }, [focusable, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-scrim p-4"
      onMouseDown={(event) => {
        pressedOnScrim.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        if (pressedOnScrim.current && event.target === event.currentTarget) onClose();
        pressedOnScrim.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          "my-auto flex w-full max-w-modal flex-col gap-5 rounded-2xl bg-canvas p-8 shadow-modal outline-none",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-h3 tracking-[-0.4px] text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-bodyM text-ink-secondary">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.web.ui.close}
            className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-tertiary hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
