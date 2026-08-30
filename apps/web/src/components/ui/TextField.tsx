"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Поле ввода. Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3274:38 / 3274:40 /
 * 3274:42 — высота 48, паддинг 13/16, радиус 12, кегль 15/22 Medium.
 * Обводка: в покое 1 px #B2B2B2, в фокусе 2 px #B33036, при ошибке
 * 2 px #C62828.
 *
 * Подпись над полем взята из макета модалки входа (узел 3272:12) — 13/18
 * Medium цветом #595959; в блоке «ПОЛЯ И СТАТУСЫ» подписи нет, но поле без
 * <label> недоступно с клавиатуры и для скринридера, поэтому она обязательна.
 *
 * Сообщение об ошибке связано с полем через `aria-describedby`, а само поле
 * помечено `aria-invalid` — красной рамки недостаточно: дальтоник её не
 * различит, а скринридер её вообще не видит.
 */
export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
  label: string;
  /** Текст ошибки. Непустая строка одновременно включает и красное
   * оформление — двух источников правды про «поле сломано» быть не должно. */
  error?: string;
  /** Поясняющая подпись под полем, когда ошибки нет. */
  hint?: string;
  /** Например, выбор кода страны слева от ввода (узел 3272:14). Имя не
   * `prefix`: так называется настоящий HTML-атрибут, и одноимённый проп
   * ломает наследование от InputHTMLAttributes. */
  leadingSlot?: ReactNode;
  className?: string;
}

export function TextField({ label, error, hint, leadingSlot, className, ...rest }: TextFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  const invalid = Boolean(error);

  return (
    <div className={cx("flex w-full flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium leading-[18px] text-ink-secondary">
        {label}
      </label>
      <div
        className={cx(
          "flex h-input items-center gap-3 rounded-md bg-canvas px-input-x",
          // Толщина рамки берётся из состояния: 2 px в фокусе и при ошибке,
          // 1 px в покое (макет рисует именно так). `focus-within`, а не
          // `focus`, потому что рамку несёт обёртка, а фокус получает input.
          invalid
            ? "border-2 border-danger-text"
            : "border border-line-control focus-within:border-2 focus-within:border-brand",
        )}
      >
        {leadingSlot}
        <input
          {...rest}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={message ? messageId : undefined}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium leading-[22px] text-ink outline-none placeholder:text-ink-tertiary disabled:text-ink-disabled"
        />
      </div>
      {message ? (
        <p
          id={messageId}
          role={invalid ? "alert" : undefined}
          className={cx("text-[13px] leading-[18px]", invalid ? "text-danger-text" : "text-ink-tertiary")}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
