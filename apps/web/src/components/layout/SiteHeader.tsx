"use client";

import Link from "next/link";

import { Container } from "@web/components/layout/Container";
import { BrandLogo } from "@web/components/layout/BrandLogo";
import { Button } from "@web/components/ui/Button";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Шапка сайта — экземпляр «Web» на кадре главной, Figma
 * 49Zk9oEV3ZCiCdh6Cz9dE2, узел 3549:5823.
 *
 * Высота 84 (паддинг 18 вокруг кнопки 48), белый фон, нижняя граница #DADADA.
 * Слева знак марки и меню через просвет 40, между пунктами 28. Справа через
 * просвет 12: капсула города, ссылка «Для бизнеса» (сейчас скрыта, см.
 * SHOW_FOR_BUSINESS) и ОДНА главная кнопка «Войти» со значком гостя.
 *
 * Активный пункт — фирменный #B33036 SemiBold с подчёркиванием 4 px
 * (узел 3280:4348), остальные — #7D7D7D Medium 16/24.
 *
 * Вошедшему гостю на месте «Войти» показывается имя и «Выйти»: этого состояния
 * в макете нет вовсе — там нарисован только гость без сессии.
 *
 * Подписи пунктов берутся из словаря ПО КЛЮЧУ, а не передаются строкой:
 * шапка живёт в клиентском дереве, где язык может смениться в любой момент,
 * и заранее посчитанная подпись осталась бы на прежнем языке.
 */
export type NavKey = "home" | "venues" | "events" | "guide";

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
  /** Кто вошёл. `undefined` — сессия ещё читается из хранилища, и до этого
   * момента шапка не должна мигать кнопкой «Войти» тому, кто уже вошёл. */
  account?: { name: string } | null;
  onSignOut?: () => void;
  className?: string;
}

/**
 * ВРЕМЕННО: пункт «Для бизнеса» убран из шапки по решению владельца
 * (30.08.2026) — страницы `/business` ещё нет, и ссылка вела в 404 Next.
 * Возврат — ОДНА строка: поставить здесь `true`. Ни разметку, ни словарь
 * (`t.web.header.forBusiness` во всех трёх языках) для этого трогать не надо.
 *
 * В макете (узел 3549:5740) ссылка ЕСТЬ — это расхождение сознательное.
 */
export const SHOW_FOR_BUSINESS: boolean = false;

/**
 * Имя вошедшего гостя ведёт на `/profile` (узел 3525:15153). Флаг был выключен,
 * пока роута `apps/web/app/profile/page.tsx` не существовало и клик по
 * собственному имени вёл в 404 Next; страница появилась 2026-09-05 (ветка
 * `feat/web-profile-screen`), и ссылка включена. Ветка с текстом вместо ссылки
 * оставлена: выключить обратно — одна строка.
 */
export const SHOW_PROFILE_LINK: boolean = true;

/**
 * Пункты ровно в порядке макета (узел 3549:5727) — их ТРИ: «Главная»,
 * «Заведения», «Гастрогид». Раньше здесь было пять: лишние «Афиша» и «Статьи»
 * достались от более старого компонента шапки и вели в 404 Next. Замечание
 * владельца 01.09.2026 «тексты не совпадают с макетом» — про них в том числе.
 *
 * «Гастрогид» тоже пока отвечает 404: раздела у сайта нет. Пункт оставлен,
 * потому что он НАРИСОВАН в макете; убрать его — отдельное решение владельца,
 * а не догадка вёрстки.
 */
export const HEADER_NAV: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "venues", href: "/venues" },
  // «Афиша» — роут /events появился 2026-09-05 (узел 5033:6703).
  { key: "events", href: "/events" },
  { key: "guide", href: "/guide" },
];

export function SiteHeader({
  items = HEADER_NAV,
  activeKey,
  city,
  cities,
  onCityChange,
  onCityClick,
  account,
  onSignOut,
  className,
}: SiteHeaderProps) {
  const t = useT();

  return (
    <header className={cx("w-full border-b border-line-strong bg-canvas", className)}>
      <Container className="flex min-h-header flex-wrap items-center justify-between gap-4 py-header-y">
        <div className="flex flex-wrap items-center gap-6 lg:gap-header-brand-gap">
          <Link
            href="/"
            aria-label={t.web.header.brand}
            className="inline-flex items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <BrandLogo />
          </Link>
          <nav aria-label={t.web.header.navLabel}>
            <ul className="flex flex-wrap items-center gap-5 lg:gap-header-nav-gap">
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
                        className={cx(
                          "h-nav-underline w-full rounded-nav-underline",
                          active ? "bg-brand" : "bg-transparent",
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-header-right-gap">
          {cities && cities.length > 0 ? (
            // Обычный <select>, а не своя выпадашка: список городов короткий,
            // а нативный элемент бесплатно даёт клавиатуру, поиск по первой
            // букве и системный список на любом устройстве. Внешне это та же
            // капсула из макета (узел 3549:5734).
            <span className="relative inline-flex h-city-pill items-center gap-city-pill-gap rounded-full bg-subtle px-city-pill-x text-[14px] font-medium leading-5 text-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
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
              className="inline-flex h-city-pill items-center gap-city-pill-gap rounded-full bg-subtle px-city-pill-x text-[14px] font-medium leading-5 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
          {account === undefined ? (
            // Сессия ещё читается из localStorage. Место под кнопку держим,
            // чтобы шапка не дёрнулась, когда состояние станет известно.
            <span aria-hidden="true" className="h-btn-header w-[109px]" />
          ) : account ? (
            <>
              {/* Имя — ссылка на страницу гостя (`/profile`, узел 3525:15153).
                  В макете шапки вошедшего нет вовсе, поэтому ссылка стоит на
                  месте, где макет главной рисует «Войти». Текстом имя
                  показывается только с выключенным SHOW_PROFILE_LINK. */}
              {SHOW_PROFILE_LINK ? (
                <Link
                  href="/profile"
                  className="max-w-[180px] truncate rounded-sm text-[14px] font-medium leading-5 text-ink hover:text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {account.name}
                </Link>
              ) : (
                <span className="max-w-[180px] truncate text-[14px] font-medium leading-5 text-ink">
                  {account.name}
                </span>
              )}
              <Button size="header" variant="secondary" onClick={onSignOut}>
                {t.web.header.signOut}
              </Button>
            </>
          ) : (
            /* В макете кнопка ОДНА — «Войти» со значком гостя (узел 3549:6440).
               Отдельной «Регистрации» рядом нет и у бэкенда её тоже нет:
               `POST /auth/otp/verify` создаёт учётную запись, если номер новый,
               то есть вход и регистрация — это буквально один экран. */
            <Button size="header" variant="primary" asLink href="/login">
              <UserIcon />
              {t.web.header.signIn}
            </Button>
          )}
        </div>
      </Container>
    </header>
  );
}

/**
 * Значок города — «Linear / Map & Location / Map Point Wave» (узел 3549:5735),
 * выгружен из макета как SVG. Прежняя булавка была нарисована здесь от руки и
 * с макетом не совпадала: у знака макета есть третья дуга-«волна» под пином.
 */
function PinIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 text-brand"
    >
      <path
        d="M6.40002 9.21171C6.40002 6.33336 8.90723 4 12 4C15.0928 4 17.6 6.33336 17.6 9.21171C17.6 12.0675 15.8127 15.3999 13.0241 16.5916C12.374 16.8695 11.626 16.8695 10.976 16.5916C8.18735 15.3999 6.40002 12.0675 6.40002 9.21171Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M13.6 9.6C13.6 10.4837 12.8837 11.2 12 11.2C11.1164 11.2 10.4 10.4837 10.4 9.6C10.4 8.71634 11.1164 8 12 8C12.8837 8 13.6 8.71634 13.6 9.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.1684 14.8C19.7007 15.282 20 15.8253 20 16.4C20 18.3882 16.4183 20 12 20C7.58172 20 4 18.3882 4 16.4C4 15.8253 4.29929 15.282 4.83157 14.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Значок гостя на кнопке «Войти» (узел 3549:6441), выгружен из макета. */
function UserIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <circle cx="12" cy="7.2" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M18.4 16.4C18.4 18.3882 18.4 20 12 20C5.59998 20 5.59998 18.3882 5.59998 16.4C5.59998 14.4118 8.46535 12.8 12 12.8C15.5346 12.8 18.4 14.4118 18.4 16.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
