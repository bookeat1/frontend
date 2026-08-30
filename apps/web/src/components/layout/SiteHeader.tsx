"use client";

import Link from "next/link";

import { Container } from "@web/components/layout/Container";
import { Button } from "@web/components/ui/Button";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Шапка сайта. Figma 3z0f6dgev4HMwBAHPjTjPo, компонент «Web / Header»
 * (узел 3367:10653): высота 80, паддинг 18/120, белый фон, нижняя граница
 * #DADADA, слева логотип и меню с просветом 28, справа селектор города,
 * ссылка «Для бизнеса» (сейчас скрыта, см. SHOW_FOR_BUSINESS), вторичная
 * кнопка «Войти» и главная «Регистрация».
 *
 * Активный пункт меню в макете — фирменный цвет и подчёркивание 4 px
 * (узел 3280:4350), остальные — #7D7D7D Medium.
 *
 * Подписи пунктов берутся из словаря ПО КЛЮЧУ, а не передаются строкой:
 * шапка живёт в клиентском дереве, где язык может смениться в любой момент,
 * и заранее посчитанная подпись осталась бы на прежнем языке.
 */
export type NavKey = "home" | "venues" | "afisha" | "guide" | "articles";

export interface NavItem {
  key: NavKey;
  href: string;
}

export interface SiteHeaderProps {
  items?: readonly NavItem[];
  /** Ключ активного пункта. Экраны передают его сами. */
  activeKey?: string;
  /** Название города берётся из данных, а не из словаря. */
  city?: string;
  /** Города из `GET /cities`. Больше одного — селектор становится списком. */
  cities?: readonly string[];
  onCityChange?: (city: string) => void;
  onCityClick?: () => void;
  onSignIn?: () => void;
  onSignUp?: () => void;
  className?: string;
}

/** Пункты ровно в порядке макета. Экспортируются, чтобы страницы не
 * пересобирали список заново и он не разъехался между разделами.
 *
 * Разделы «Афиша», «Гастрогид» и «Статьи» веб ещё не собрал — ссылки ведут на
 * будущие адреса. Убирать пункты из шапки нельзя (макет рисует пять), но и
 * обещать работающую страницу мы не можем: до её появления ссылка вернёт 404
 * Next, а не молчаливое «ничего не произошло». */
/**
 * ВРЕМЕННО: пункт «Для бизнеса» убран из шапки по решению владельца
 * (30.08.2026) — страницы `/business` ещё нет, и ссылка вела в 404 Next.
 * Возврат — ОДНА строка: поставить здесь `true`. Ни разметку, ни словарь
 * (`t.web.header.forBusiness` во всех трёх языках) для этого трогать не надо.
 */
export const SHOW_FOR_BUSINESS: boolean = false;

export const HEADER_NAV: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "venues", href: "/venues" },
  { key: "afisha", href: "/afisha" },
  { key: "guide", href: "/guide" },
  { key: "articles", href: "/articles" },
];

export function SiteHeader({
  items = HEADER_NAV,
  activeKey,
  city,
  cities,
  onCityChange,
  onCityClick,
  onSignIn,
  onSignUp,
  className,
}: SiteHeaderProps) {
  const t = useT();

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
                      {t.web.header.nav[item.key]}
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
          {cities && cities.length > 0 ? (
            // Обычный <select>, а не своя выпадашка: список городов короткий,
            // а нативный элемент бесплатно даёт клавиатуру, поиск по первой
            // букве и системный список на любом устройстве. Внешне это та же
            // капсула из макета (узел 3280:4372).
            <span className="relative inline-flex h-11 items-center gap-2 rounded-full bg-subtle px-3.5 text-[14px] font-medium leading-5 text-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
              <PinIcon />
              <select
                aria-label={t.web.header.cityLabel}
                value={city ?? cities[0]}
                onChange={(event) => onCityChange?.(event.target.value)}
                className="cursor-pointer appearance-none bg-transparent pr-1 text-[14px] font-medium leading-5 text-ink outline-none"
              >
                {cities.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </span>
          ) : city ? (
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
          {SHOW_FOR_BUSINESS ? (
            <Link
              href="/business"
              className="px-2.5 py-2.5 text-[14px] font-medium leading-5 text-ink-secondary hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {t.web.header.forBusiness}
            </Link>
          ) : null}
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
