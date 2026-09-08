"use client";

import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Нумерация страниц — Figma QovvuAoI9YxsLMwWkfgKN8, узел 3525:14500: квадраты
 * 44×44, радиус 12, просвет 8, активная страница залита фирменным, между
 * далёкими номерами многоточие.
 *
 * Обводка неактивных квадратов — `border/strong` (#DADADA): в дереве узла
 * (`spec-filter-page.md`, 3525:14501 и 3525:14505…14515) стоит
 * `strokeColor #dadada`. Раньше стояла `border/default` по замеру живого
 * файла 2026-09-02 — спека 2026-09-03 говорит иное, и она источник истины
 * (см. `webCatalogPagination`). Многоточие (3525:14511) — без заливки и
 * обводки. Кегль и вес подписи — утилиты `text-page` / `text-page-current`.
 *
 * Резать выдачу на страницы приходится на клиенте: `/restaurants/search` не
 * принимает номер страницы, а всю выдачу (до сотни записей) отдаёт разом —
 * см. комментарий у `paginate`.
 */
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  const t = useT();
  if (pages <= 1) return null;

  return (
    <nav aria-label={t.web.catalog.pagination.label} className="flex flex-wrap justify-center gap-2">
      <PageButton
        label="‹"
        title={t.web.catalog.pagination.prev}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      />
      {pageNumbers(page, pages).map((item, index) =>
        item === null ? (
          <span
            // Многоточий может быть два — слева и справа от текущей страницы,
            // и различить их можно только позицией.
            key={`gap-${index}`}
            aria-hidden="true"
            className="inline-flex h-page w-page items-center justify-center text-page text-ink"
          >
            …
          </span>
        ) : (
          <PageButton
            key={item}
            label={String(item)}
            title={t.web.catalog.pagination.page(item)}
            current={item === page}
            onClick={() => onChange(item)}
          />
        ),
      )}
      <PageButton
        label="›"
        title={t.web.catalog.pagination.next}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      />
    </nav>
  );
}

function PageButton({
  label,
  title,
  current = false,
  disabled = false,
  onClick,
}: {
  label: string;
  title: string;
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      aria-current={current ? "page" : undefined}
      className={cx(
        "inline-flex h-page w-page items-center justify-center rounded-md border",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:text-ink-disabled",
        current
          ? "border-brand bg-brand text-page-current text-ink-on-brand"
          : "border-line-strong bg-canvas text-page text-ink hover:bg-subtle",
      )}
    >
      <span aria-hidden="true">{label}</span>
    </button>
  );
}

/**
 * Какие номера показать: первая, последняя, текущая и её соседи; на разрывах —
 * `null`, который рисуется многоточием. Ровно та раскладка, что в макете
 * (1 2 3 4 … 26).
 */
export function pageNumbers(page: number, pages: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let index = 1; index <= pages; index += 1) {
    const nearCurrent = Math.abs(index - page) <= 1;
    const edge = index === 1 || index === pages;
    if (edge || nearCurrent) {
      result.push(index);
    } else if (result[result.length - 1] !== null) {
      result.push(null);
    }
  }
  return result;
}
