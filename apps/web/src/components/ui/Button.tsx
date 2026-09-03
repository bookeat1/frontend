"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Кнопка десктопного веба. Единственная — второй, «чуть другой», быть не
 * должно.
 *
 * Размеры и варианты сняты из Figma 3z0f6dgev4HMwBAHPjTjPo, блок «КНОПКИ»
 * (узел 3274:6): L — 54 высотой, паддинг 15/28, радиус 16; M — 42 высотой,
 * паддинг 11/20, радиус 12. Вторичная — только обводка #B2B2B2 без заливки,
 * разрушающая — вообще без фона, один тёмно-красный текст #8E1B1B,
 * неактивная — заливка #E7E7E7 и текст #B2B2B2.
 *
 * `loading` НЕ убирает подпись: кнопка не должна менять ширину под курсором,
 * а голый спиннер не читается вслух. Пока идёт запрос, кнопка disabled —
 * повторный клик по ней безвреден.
 */
type Variant = "primary" | "secondary" | "outline" | "danger";
/**
 * `l` и `m` — размеры кита (узел 3274:6). `submit` в ките не нарисован, но
 * дважды нарисован на ЭКРАНАХ: «Получить код» в модалке входа (3272:19) и
 * «Найти» в панели поиска (3253:52) — оба 48 высотой с радиусом 14. Это
 * отдельная ступень, а не «почти L»: 54 и радиус 16 в этих местах заметно
 * крупнее макета.
 *
 * `action` — обводочная кнопка в шапке страницы заведения («Сохранить» и
 * «Поделиться», узлы 3261:69 и 3261:72): 46 высотой, радиус 12, паддинг 16,
 * просвет 8, кегль 14/20 SemiBold. Тоже не «почти M» (42 и паддинг 20).
 *
 * `header` — единственная кнопка шапки, «Войти» (узел 3549:6440): 48 высотой,
 * радиус 12, паддинг 16, просвет 8, кегль 14/20 SemiBold. Ни M (42), ни
 * `submit` (радиус 14) сюда не попадают.
 *
 * `ticket` — «Изменить бронь» на экране успеха (узел 3525:15105): 48 высотой,
 * радиус 14, кегль 14/20 SemiBold. От `submit` (тоже 48 и 14) отличается
 * ровно кеглем: соседняя с ней «На главную» набрана 16/24, и одна ступень на
 * две разные подписи не годится.
 *
 * `booking` — «Забронировать на 19:30» в карточке брони (QovvuAoI9YxsLMwWkfgKN8,
 * узел 3525:14768): ДВЕ строки друг под другом через 2, паддинг 14 по
 * вертикали, радиус 14, фиксированной высоты нет. Единственный размер, где
 * содержимое идёт колонкой, — поэтому у него и другой `gap`.
 */
type Size = "l" | "m" | "submit" | "ticket" | "action" | "header" | "booking";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Растянуть на всю ширину — так кнопка стоит в модалке (узел 3272:19). */
  block?: boolean;
  /**
   * Кнопка, которая на самом деле ПЕРЕХОД. Так выглядят «Войти» и
   * «Регистрация» в шапке: по макету это кнопки, но ведут они на страницу,
   * и `<button onClick={router.push}>` отнял бы у гостя всё, что даёт ссылка
   * — открыть в новой вкладке, скопировать адрес, увидеть его в строке
   * состояния. Второй компонент «кнопка-ссылка» заводить нельзя: он неминуемо
   * разъедется с этой кнопкой в первую же правку макета.
   */
  asLink?: boolean;
  href?: string;
  children: ReactNode;
}

/**
 * `gap` и `whitespace-nowrap` живут в РАЗМЕРЕ, а не здесь: у кнопки брони
 * подпись стоит второй строкой (просвет 2, не 8), и переопределить `gap-2`
 * снаружи нельзя — у двух утилит одного свойства одинаковая специфичность, и
 * побеждает та, что Tailwind сгенерировал позже, то есть `gap-0.5`, а не та,
 * которую передали.
 */
const base =
  "inline-flex items-center justify-center font-semibold " +
  "transition-colors focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "disabled:cursor-not-allowed";

const sizes: Record<Size, string> = {
  l: "h-btn-l gap-2 whitespace-nowrap px-btn-l-x rounded-lg text-[16px] leading-6",
  m: "h-btn-m gap-2 whitespace-nowrap px-btn-m-x rounded-md text-[14px] leading-5",
  submit: "h-login-submit gap-2 whitespace-nowrap px-btn-l-x rounded-field text-[16px] leading-6",
  ticket: "h-login-submit gap-2 whitespace-nowrap px-btn-l-x rounded-field text-[14px] leading-5",
  action: "h-venue-action gap-2 whitespace-nowrap px-venue-action-x rounded-md text-[14px] leading-5",
  header: "h-btn-header gap-2 whitespace-nowrap px-btn-header-x rounded-md text-[14px] leading-5",
  booking: "flex-col gap-0.5 py-booking-cta-y rounded-field text-booking-cta",
};

/**
 * Неактивное состояние у всех вариантов одинаковое — заливка #E7E7E7 и текст
 * #B2B2B2 (узел 3274:17). Поэтому оно вынесено из таблицы вариантов: иначе
 * каждый новый вариант обязан был бы повторить его заново и однажды забыл бы.
 */
const disabledLook =
  "disabled:bg-disabled disabled:text-ink-disabled disabled:border-transparent";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-ink-on-brand border border-transparent hover:bg-brand-text",
  secondary: "bg-canvas text-ink border border-line-control hover:bg-subtle",
  /**
   * Фирменная обводка без заливки — «Изменить бронь» на экране успеха (узел
   * 3525:15105) и «Забронировать без предзаказа» в сводке (3525:14973): рамка
   * и текст фирменные, фон прозрачный.
   *
   * Это НЕ `secondary`: у той обводка нейтральная (#B2B2B2) и текст основной.
   * Разница видна на экране успеха, где обе кнопки стоят рядом.
   */
  outline: "bg-transparent text-brand-text border border-brand hover:bg-brand-subtle",
  danger: "bg-transparent text-danger-strong border border-transparent hover:bg-danger",
};

export function Button({
  variant = "primary",
  size = "l",
  loading = false,
  block = false,
  asLink = false,
  href,
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const look = cx(base, sizes[size], variants[variant], disabledLook, block && "w-full", className);

  if (asLink && href) {
    return (
      <Link href={href} className={look}>
        {children}
      </Link>
    );
  }

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={look}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

/** Кружок-крутилка. `aria-hidden`, потому что состояние уже озвучено
 * атрибутом `aria-busy` на самой кнопке. */
function Spinner() {
  const t = useT();
  return (
    <span
      aria-hidden="true"
      title={t.web.ui.loading}
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
