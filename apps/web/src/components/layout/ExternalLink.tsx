"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

import { useT } from "@web/lib/locale";

/**
 * Ссылка, уводящая с сайта (лендинг для бизнеса, кабинет ресторана). Три вещи
 * всегда вместе: `target="_blank"`, `rel="noopener noreferrer"` (открытая
 * вкладка не получает доступ к `window.opener`) и `aria-label` с пометкой
 * «откроется в новой вкладке» — без неё уход со страницы для гостя со
 * скринридером был бы сюрпризом.
 */
export interface ExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel" | "href" | "children"> {
  href: string;
  children: ReactNode;
  /** Видимый текст ссылки — озвучивается вместе с пометкой про новую вкладку. */
  label: string;
}

export function ExternalLink({ href, children, label, ...rest }: ExternalLinkProps) {
  const t = useT();

  return (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer" aria-label={t.web.a11y.opensInNewTab(label)}>
      {children}
    </a>
  );
}
