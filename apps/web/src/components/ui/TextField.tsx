"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Поле ввода.
 *
 * ДВА РАЗМЕРА, ПОТОМУ ЧТО В МАКЕТЕ ИХ ДВА, и они не сводятся друг к другу:
 *
 *   `m` — поле кита, узлы 3274:38 / 3274:40 / 3274:42: высота 48,
 *         паддинг 13/16, радиус 12, кегль 15/22 Medium;
 *   `l` — поле экрана входа, узел 3272:13: высота 52, паддинг 14/16,
 *         радиус 14, кегль 16/24 Medium, просвет между блоками 12.
 *
 * Раньше вход рисовался размером кита, и радиус выходил 12 вместо 14 — это и
 * увидел владелец. Усреднять нельзя: тогда не совпадёт ни один из двух узлов.
 * Числа лежат в `webControls.input` и `webLoginModal.field`.
 *
 * Обводка в обоих размерах одинаковая: в покое 1 px #B2B2B2, в фокусе
 * 2 px #B33036, при ошибке 2 px #C62828.
 *
 * ФОКУС НЕ ДВИГАЕТ СОДЕРЖИМОЕ. Вторая единица толщины добавляется не сменой
 * `border` с 1 на 2 (это сдвинуло бы всё внутри поля на пиксель), а
 * внутренним кольцом `ring-inset` поверх той же рамки. Видно ровно 2 px
 * цвета макета, вёрстка при этом стоит на месте.
 *
 * Подпись над полем взята из макета модалки входа (узел 3272:12) — 13/18
 * Medium цветом #595959, просвет до рамки 6 (узел 3272:11). В блоке
 * «ПОЛЯ И СТАТУСЫ» подписи нет, но поле без <label> недоступно с клавиатуры
 * и для скринридера, поэтому она обязательна.
 *
 * Сообщение об ошибке связано с полем через `aria-describedby`, а само поле
 * помечено `aria-invalid` — красной рамки недостаточно: дальтоник её не
 * различит, а скринридер её вообще не видит.
 */
export type TextFieldSize = "m" | "l";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className" | "size"> {
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
  /** `m` — кит (3274:38), `l` — модалка входа (3272:13). */
  size?: TextFieldSize;
  className?: string;
}

const boxSizes: Record<TextFieldSize, string> = {
  m: "h-input gap-3 rounded-md px-input-x",
  l: "h-login-field gap-login-field-gap rounded-field px-login-field-x",
};

const inputSizes: Record<TextFieldSize, string> = {
  m: "text-[15px] leading-[22px]",
  l: "text-[16px] leading-6",
};

export function TextField({
  label,
  error,
  hint,
  leadingSlot,
  size = "m",
  className,
  ...rest
}: TextFieldProps) {
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
          "flex items-center border bg-canvas",
          boxSizes[size],
          // `focus-within`, а не `focus`: рамку несёт обёртка, а фокус
          // получает input внутри неё.
          invalid
            ? "border-danger-text ring-1 ring-inset ring-danger-text"
            : "border-line-control focus-within:border-brand focus-within:ring-1 focus-within:ring-inset focus-within:ring-brand",
        )}
      >
        {leadingSlot}
        <input
          {...rest}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={message ? messageId : undefined}
          className={cx(
            "min-w-0 flex-1 bg-transparent font-medium text-ink outline-none placeholder:text-ink-tertiary disabled:text-ink-disabled",
            inputSizes[size],
          )}
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
