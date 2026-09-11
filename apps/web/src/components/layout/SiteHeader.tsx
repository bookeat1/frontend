"use client";

import Link from "next/link";
import { useCallback, useId, useState } from "react";

import { Container } from "@web/components/layout/Container";
import { BrandLogo } from "@web/components/layout/BrandLogo";
import { ExternalLink } from "@web/components/layout/ExternalLink";
import { PROMOS_PATH, SHOW_PROMOS_LINK } from "@web/components/home/Cards";
import { Button } from "@web/components/ui/Button";
import { Modal } from "@web/components/ui/Modal";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";
import { BUSINESS_URL } from "@web/lib/site-links";

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
 * НИЖЕ `xl` строка из макета не рисуется вовсе (`apps/web/docs/responsive.md`,
 * § 5, дыра № 1): в макете нет мобильной шапки, у сайта на 360 px нет ни
 * бургера, ни своей структуры для узкого экрана — источник для НЕЁ не Figma
 * WEB (там только кадр 1440), а обычный контракт «кнопка-меню открывает
 * список» без привязки к конкретному кадру. Ниже `xl` видны только логотип и
 * кнопка-бургер; пункты меню, город, «Для бизнеса» и вход/выход уезжают в
 * панель поверх страницы — общий `Modal` (тот же примитив, что шторка
 * фильтров каталога), а не новый оверлей.
 *
 * Порог именно `xl` (1280), а не общий для сайта `lg` (1024): шесть пунктов
 * меню («Главная… Статьи») плюс город/«Для бизнеса»/кнопка входа физически
 * не помещаются в контейнер на 1024–1100 px, что и ломало высоту шапки
 * (перенос «Статьи» и «Для бизнеса» на вторую строку). На 1280 строка влезает
 * с запасом (проверено скриншотом), поэтому бургер отдан всему диапазону
 * 0–1279, а не только 0–1023.
 *
 * Подписи пунктов берутся из словаря ПО КЛЮЧУ, а не передаются строкой:
 * шапка живёт в клиентском дереве, где язык может смениться в любой момент,
 * и заранее посчитанная подпись осталась бы на прежнем языке.
 */
export type NavKey = "home" | "venues" | "events" | "guide" | "articles" | "promos";

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
 * Пункт «Для бизнеса» (узел 3549:5740). Был скрыт 30.08.2026, пока на сайте
 * не было своей страницы `/business`, и ссылка вела в 404 Next. Решение
 * 2026-09-06 (спека `web-fixes-20260906.md`, T3): своей страницы по-прежнему
 * нет, но она и не нужна — ссылка ведёт на готовый лендинг для бизнеса
 * `book-eat.app` (`BUSINESS_URL`, `@web/lib/site-links`), внешняя, в новой
 * вкладке.
 */
export const SHOW_FOR_BUSINESS: boolean = true;

/**
 * Имя вошедшего гостя ведёт на `/profile` (узел 3525:15153). Флаг был выключен,
 * пока роута `apps/web/app/profile/page.tsx` не существовало и клик по
 * собственному имени вёл в 404 Next; страница появилась 2026-09-05 (ветка
 * `feat/web-profile-screen`), и ссылка включена. Ветка с текстом вместо ссылки
 * оставлена: выключить обратно — одна строка.
 */
export const SHOW_PROFILE_LINK: boolean = true;

/**
 * Порядок пунктов подтверждён владельцем 2026-09-09 (постмёрдж-фиксы к PR
 * #177): Главная, Заведения, Акции, Афиша, Гастрогид, Статьи. Изначально
 * (узел 3549:5727) их было три — «Главная», «Заведения», «Гастрогид» — и
 * «Афиша»/«Статьи»/«Акции» добавлялись позже отдельными роутами, каждый раз
 * в конец списка; это расхождение с макетом и было замечанием.
 *
 * «Гастрогид» ведёт на `/guide` (роут есть с 2026-09-09), «Акции» — за
 * `SHOW_PROMOS_LINK` (`components/home/Cards.tsx`), листинг `/promos`
 * появился 2026-09-07 (владелец отменил решение от 2026-09-04 «Акции на веб
 * не переносим»), флаг включён.
 */
export const HEADER_NAV: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "venues", href: "/venues" },
  ...(SHOW_PROMOS_LINK ? [{ key: "promos" as const, href: PROMOS_PATH }] : []),
  // «Афиша» — роут /events появился 2026-09-05 (узел 5033:6703).
  { key: "events", href: "/events" },
  { key: "guide", href: "/guide" },
  /** Пункт «Статьи» (узел I5034:9889;5034:8724): роут `/articles` есть. */
  { key: "articles", href: "/articles" },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const navList = (stacked: boolean) => (
    <ul
      className={
        stacked
          ? "flex flex-col gap-1"
          : "flex flex-nowrap items-center gap-header-nav-gap"
      }
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={stacked ? closeMenu : undefined}
              className={cx(
                stacked
                  ? "flex h-11 items-center rounded-sm text-[16px] leading-6"
                  : "inline-flex flex-col items-center gap-2 text-[16px] leading-6",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                active ? "font-semibold text-brand" : "font-medium text-ink-tertiary hover:text-ink",
              )}
            >
              {t.web.header.nav[item.key]}
              {stacked ? null : (
                // Подчёркивание рисуется всегда, но прозрачным: иначе
                // активный пункт был бы на 12 px выше соседей и меню
                // дёргалось бы при переходе. В стопке мобильного меню
                // подчёркивание не нужно — там активный пункт и так один
                // жирный текст в списке.
                <span
                  aria-hidden="true"
                  className={cx(
                    "h-nav-underline w-full rounded-nav-underline",
                    active ? "bg-brand" : "bg-transparent",
                  )}
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const cityControl = (stacked: boolean) =>
    cities && cities.length > 0 ? (
      // Обычный <select>, а не своя выпадашка: список городов короткий,
      // а нативный элемент бесплатно даёт клавиатуру, поиск по первой
      // букве и системный список на любом устройстве. Внешне это та же
      // капсула из макета (узел 3549:5734).
      <span
        className={cx(
          "relative inline-flex h-city-pill items-center gap-city-pill-gap rounded-full bg-subtle px-city-pill-x text-[14px] font-medium leading-5 text-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
          stacked && "w-full",
        )}
      >
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
        onClick={() => {
          onCityClick?.();
          if (stacked) closeMenu();
        }}
        aria-label={t.web.header.cityLabel}
        className={cx(
          "inline-flex h-city-pill items-center gap-city-pill-gap rounded-full bg-subtle px-city-pill-x text-[14px] font-medium leading-5 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          stacked && "w-full",
        )}
      >
        <PinIcon />
        {city}
      </button>
    ) : null;

  const businessLink = (stacked: boolean) =>
    SHOW_FOR_BUSINESS ? (
      <ExternalLink
        href={BUSINESS_URL}
        label={t.web.header.forBusiness}
        className={cx(
          "px-2.5 py-2.5 text-[14px] font-medium leading-5 text-ink-secondary hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          stacked && "flex h-11 w-full items-center px-0",
        )}
      >
        {t.web.header.forBusiness}
      </ExternalLink>
    ) : null;

  const accountControl = (stacked: boolean) =>
    account === undefined ? (
      // Сессия ещё читается из localStorage. Место под кнопку держим,
      // чтобы шапка не дёрнулась, когда состояние станет известно.
      <span aria-hidden="true" className={cx("h-btn-header", stacked ? "w-full" : "w-[109px]")} />
    ) : account ? (
      <div className={stacked ? "flex flex-col gap-3" : "flex items-center gap-header-right-gap"}>
        {/* Имя — ссылка на страницу гостя (`/profile`, узел 3525:15153).
            В макете шапки вошедшего нет вовсе, поэтому ссылка стоит на
            месте, где макет главной рисует «Войти». Текстом имя
            показывается только с выключенным SHOW_PROFILE_LINK. */}
        {SHOW_PROFILE_LINK ? (
          <Link
            href="/profile"
            onClick={stacked ? closeMenu : undefined}
            className="max-w-[180px] truncate rounded-sm text-[14px] font-medium leading-5 text-ink hover:text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {account.name}
          </Link>
        ) : (
          <span className="max-w-[180px] truncate text-[14px] font-medium leading-5 text-ink">
            {account.name}
          </span>
        )}
        <Button
          size="header"
          variant="secondary"
          block={stacked}
          onClick={() => {
            onSignOut?.();
            if (stacked) closeMenu();
          }}
        >
          {t.web.header.signOut}
        </Button>
      </div>
    ) : (
      /* В макете кнопка ОДНА — «Войти» со значком гостя (узел 3549:6440).
         Отдельной «Регистрации» рядом нет и у бэкенда её тоже нет:
         `POST /auth/otp/verify` создаёт учётную запись, если номер новый,
         то есть вход и регистрация — это буквально один экран. */
      <Button
        size="header"
        variant="primary"
        asLink
        href="/login"
        block={stacked}
        onClick={stacked ? closeMenu : undefined}
      >
        <UserIcon />
        {t.web.header.signIn}
      </Button>
    );

  return (
    <header className={cx("w-full border-b border-line-strong bg-canvas", className)}>
      <Container className="flex min-h-header items-center justify-between gap-4 py-header-y">
        <div className="flex items-center gap-6 lg:gap-header-brand-gap">
          <Link
            href="/"
            aria-label={t.web.header.brand}
            className="inline-flex items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <BrandLogo />
          </Link>
          {/* Ниже `xl` пункты меню, город, «Для бизнеса» и вход уезжают в
              панель по бургеру (дыра № 1, `apps/web/docs/responsive.md`,
              § 5) — здесь остаётся только строка макета `xl:` и выше.
              Порог поднят с `lg` (1024) на `xl` (1280) 2026-09-11: шесть
              пунктов меню + правая группа физически не помещаются в
              контейнер на 1024 — «Статьи» и «Для бизнеса» переносились
              на вторую строку и ломали высоту шапки (`flex-wrap` строки
              это маскировал, а не чинил, см. заголовок компонента). На
              1280 строка проверена скриншотом — влезает с запасом. */}
          <nav aria-label={t.web.header.navLabel} className="hidden xl:block">
            {navList(false)}
          </nav>
        </div>

        <div className="hidden items-center gap-header-right-gap xl:flex">
          {cityControl(false)}
          {businessLink(false)}
          {accountControl(false)}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls={navId}
          aria-label={t.web.header.openMenu}
          className="flex h-11 w-11 items-center justify-center rounded-md text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand xl:hidden"
        >
          <BurgerIcon />
        </button>
      </Container>

      {menuOpen ? (
        <div id={navId}>
          <Modal title={t.web.header.menuTitle} onClose={closeMenu} className="xl:hidden">
            <nav aria-label={t.web.header.navLabel}>{navList(true)}</nav>
            <div className="flex flex-col gap-3 border-t border-line-strong pt-5">
              {cityControl(true)}
              {businessLink(true)}
              {accountControl(true)}
            </div>
          </Modal>
        </div>
      ) : null}
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

/**
 * Кнопка-бургер, открывающая мобильное меню ниже `lg`. В макете Figma её нет
 * (там только кадр 1440, см. `apps/web/docs/responsive.md` § 1) — три полосы
 * это общепринятый значок «меню», а не то, что можно снять с макета.
 */
function BurgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
