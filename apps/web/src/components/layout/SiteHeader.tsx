"use client";

import Link from "next/link";

import { Container } from "@web/components/layout/Container";
import { Button } from "@web/components/ui/Button";
import { cx } from "@web/lib/cx";
import { t } from "@web/lib/i18n";

/**
 * Шапка сайта. Figma 3z0f6dgev4HMwBAHPjTjPo, компонент «Web / Header»
 * (узел 3367:10653): высота 80, паддинг 18/120, белый фон, нижняя граница
 * #DADADA, слева логотип и меню с просветом 28, справа селектор города,
 * ссылка «Для бизнеса», вторичная кнопка «Войти» и главная «Регистрация».
 *
 * Активный пункт меню в макете — фирменный цвет и подчёркивание 4 px
 * (узел 3280:4350), остальные — #7D7D7D Medium.
 *
 * Роутинга на этом этапе нет: пункты — обычные ссылки с `href`, который
 * передаёт вызывающая сторона. Подставлять сюда пути разделов до того, как
 * разделы существуют, значит выдумать контракт навигации.
 */
export interface NavItem {
  key: string;
  label: string;
  href: string;
}

export interface SiteHeaderProps {
  items?: readonly NavItem[];
  /** Ключ активного пункта. Экраны передают его сами. */
  activeKey?: string;
  /** Название города берётся из данных, а не из словаря. */
  city?: string;
  onCityClick?: () => void;
  onSignIn?: () => void;
  onSignUp?: () => void;
  className?: string;
}

/** Пункты ровно в порядке макета. Экспортируются, чтобы страницы не
 * пересобирали список заново и он не разъехался между разделами. */
export const HEADER_NAV: readonly NavItem[] = [
  { key: "home", label: t.web.header.nav.home, href: "/" },
  { key: "venues", label: t.web.header.nav.venues, href: "/venues" },
  { key: "afisha", label: t.web.header.nav.afisha, href: "/afisha" },
  { key: "guide", label: t.web.header.nav.guide, href: "/guide" },
  { key: "articles", label: t.web.header.nav.articles, href: "/articles" },
];

export function SiteHeader({
  items = HEADER_NAV,
  activeKey,
  city,
  onCityClick,
  onSignIn,
  onSignUp,
  className,
}: SiteHeaderProps) {
  return (
    <header className={cx("w-full border-b border-line-strong bg-canvas", className)}>
      <Container className="flex min-h-header flex-wrap items-center justify-between gap-4 py-[18px]">
        <div className="flex flex-wrap items-center gap-6 lg:gap-10">
          <Link
            href="/"
            className="text-[24px] font-bold leading-8 tracking-[-0.4px] text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.web.header.brand}
          </Link>
          <nav aria-label={t.web.header.navLabel}>
            <ul className="flex flex-wrap items-center gap-5 lg:gap-7">
              {items.map((item) => {
                const active = item.key === activeKey;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "inline-flex flex-col items-center gap-2 text-[16px] leading-6",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        active ? "font-semibold text-brand" : "font-medium text-ink-tertiary hover:text-ink",
                      )}
                    >
                      {item.label}
                      {/* Подчёркивание рисуется всегда, но прозрачным: иначе
                          активный пункт был бы на 12 px выше соседей и меню
                          дёргалось бы при переходе. */}
                      <span
                        aria-hidden="true"
                        className={cx("h-1 w-full rounded-sm", active ? "bg-brand" : "bg-transparent")}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {city ? (
            <button
              type="button"
              onClick={onCityClick}
              aria-label={t.web.header.cityLabel}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-subtle px-3.5 text-[14px] font-medium leading-5 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <PinIcon />
              {city}
            </button>
          ) : null}
          <Link
            href="/business"
            className="px-2.5 py-2.5 text-[14px] font-medium leading-5 text-ink-secondary hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t.web.header.forBusiness}
          </Link>
          <Button size="m" variant="secondary" onClick={onSignIn}>
            {t.web.header.signIn}
          </Button>
          <Button size="m" variant="primary" onClick={onSignUp}>
            {t.web.header.signUp}
          </Button>
        </div>
      </Container>
    </header>
  );
}

/** Значок города из макета (узел 3280:4372) — контурная булавка 24×24. */
function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-brand"
      />
      <circle cx="12" cy="11" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand" />
    </svg>
  );
}
