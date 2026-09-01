import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@web/lib/cx";

/**
 * Шапка секции главной: заголовок 30/38 Bold, подпись 15/22 #595959 и
 * ссылка «Смотреть все» справа (Figma, узлы «Section header» кадра 3253:2).
 * Подпись и ссылка необязательны — у «Выберите кухню» в макете нет ни того,
 * ни другого.
 */
export function SectionHeader({
  title,
  subtitle,
  linkHref,
  linkLabel,
  className,
}: {
  title: string;
  subtitle?: string;
  linkHref?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-h2 tracking-[-0.5px] text-ink">{title}</h2>
        {subtitle ? <p className="text-bodyM text-ink-secondary">{subtitle}</p> : null}
      </div>
      {linkHref && linkLabel ? (
        <Link
          href={linkHref}
          className="inline-flex items-center gap-1 text-[16px] font-semibold leading-[22px] text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {linkLabel}
          <ArrowIcon />
        </Link>
      ) : null}
    </div>
  );
}

export function ArrowIcon(): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 12h13m0 0-5-5m5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Секция главной: вертикальный ритм из макета (просвет 28, поля 42/120). */
export function Section({
  children,
  tone = "canvas",
  className,
}: {
  children: ReactNode;
  tone?: "canvas" | "subtle";
  className?: string;
}) {
  return (
    <section className={cx("w-full py-10", tone === "subtle" ? "bg-subtle" : "bg-canvas", className)}>
      {children}
    </section>
  );
}
