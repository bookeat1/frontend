"use client";

import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Нумерация страниц — Figma, узел «Pagination» кадра 3258:2: квадраты 44×44,
 * радиус 12, активная страница залита фирменным, между далёкими номерами
 * многоточие.
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
            className="inline-flex h-11 w-11 items-center justify-center text-[15px] leading-[22px] text-ink"
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
        "inline-flex h-11 w-11 items-center justify-center rounded-md border text-[15px] leading-[22px]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:text-ink-disabled",
        current
          ? "border-brand bg-brand font-semibold text-ink-on-brand"
          : "border-line-strong bg-canvas font-medium text-ink hover:bg-subtle",
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
