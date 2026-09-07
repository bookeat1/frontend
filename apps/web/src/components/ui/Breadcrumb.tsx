import Link from "next/link";
import { Fragment } from "react";

/** Разделитель звеньев хлебных крошек (узел 3525:14462) — пробел, слэш,
 * пробел; в макете вокруг слэша по два пробела, но это набор в одной
 * текстовой строке, а не отступ, и второй пробел браузер всё равно схлопнул
 * бы. */
const BREADCRUMB_SEPARATOR = " / ";

export interface BreadcrumbItem {
  label: string;
  /** Не задан у звена без ссылки — например у города, который сам никуда не
   * ведёт. */
  href?: string;
  /** Этот уровень — сама открытая страница, а не путь к ней: без ссылки, с
   * `aria-current="page"` для скринридеров. Цветом текущий раздел НЕ
   * выделяется — так в макете. */
  current?: boolean;
}

/**
 * Общий рендер хлебных крошек (узлы 3525:14462 «Все заведения» и 3525:14563
 * «Карточка заведения» в Figma) — одна строка 13/18 третичным цветом.
 * `items` можно передавать со «пустыми» звеньями (`null`/`false`), они
 * фильтруются: например, пока город не выбран или карточка заведения ещё не
 * загрузилась, между слэшами не остаётся пустого места.
 */
export function Breadcrumb({
  label,
  items,
}: {
  label: string;
  items: Array<BreadcrumbItem | null | undefined | false>;
}) {
  const levels = items.filter((item): item is BreadcrumbItem => Boolean(item));

  return (
    <nav aria-label={label} className="text-[13px] leading-[18px] text-ink-tertiary">
      {levels.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <span aria-hidden="true">{BREADCRUMB_SEPARATOR}</span> : null}
          {item.href && !item.current ? (
            <Link
              href={item.href}
              className="hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {item.label}
            </Link>
          ) : (
            <span aria-current={item.current ? "page" : undefined}>{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
