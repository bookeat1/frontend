"use client";

import Link from "next/link";
import type { Dictionary } from "@bookeat/i18n";

import { EVENTS_PATH } from "@web/components/home/Cards";
import { Container } from "@web/components/layout/Container";
import { ExternalLink } from "@web/components/layout/ExternalLink";
import { sectionHref } from "@web/components/profile/ProfileNav";
import { cx } from "@web/lib/cx";
import { useT, WEB_LOCALE_LABELS, type WebLocale } from "@web/lib/locale";
import { BUSINESS_URL, CABINET_URL, PRICING_URL, SITE_PAGE_PATHS } from "@web/lib/site-links";

/**
 * Подвал сайта. Figma 3z0f6dgev4HMwBAHPjTjPo, «Web / Footer» (узел 3256:77):
 * фон #1B1B1B, паддинг 64/120/32, просвет 48, четыре колонки ссылок справа от
 * блока марки, под ними линия rgba(255,255,255,.12) и нижняя строка с
 * копирайтом и переключателем языка.
 *
 * Заголовки колонок 15/22 SemiBold белым, ссылки 14/22 Regular #B2B2B2,
 * нижняя строка 13/20 #7D7D7D с белым активным языком.
 *
 * Языки — те три, что реально собраны в вебе (ru/kk/en). Остальные локали
 * `@bookeat/i18n` существуют для мобильного приложения; выдавать их здесь за
 * доступные было бы обещанием, которого веб пока не держит.
 *
 * Колонка «Ресторанам» (T3, спека `web-fixes-20260906.md`) ведёт на внешний
 * лендинг для бизнеса и боевой кабинет (`RESTAURANT_LINKS`). Пункта
 * «Поддержка» в колонке нет вовсе — владелец попросил отложить его до
 * появления номера WhatsApp-бота; рисовать мёртвую ссылку не нужно.
 *
 * Колонки «Компания»/«Помощь» (T4) ведут на семь текстовых страниц платформы
 * там, где для ключа есть слаг в `FOOTER_KEY_TO_PAGE_SLUG`; «блог» — единственный
 * ключ без страницы (`href="#"`), это T3.
 *
 * Колонка «Гостям»: «Заведения»/«Афиша»/«Гастрогид»/«Мои брони»/«Избранное»
 * ведут на реальные роуты сайта (`FOOTER_KEY_TO_HREF`, 2026-09-12) — те же
 * адреса, что уже используют шапка (`/venues`, `EVENTS_PATH`, `/guide` —
 * `SiteHeader.tsx`) и меню страницы гостя (`sectionHref` из `ProfileNav`,
 * `/profile`).
 *
 * Сетка колонок НИЖЕ `lg` (`apps/web/docs/responsive.md`, § 5, дыра № 2):
 * `flex flex-wrap justify-between` раскладывал блок марки (`max-w-[320px]`) и
 * четыре `nav`-колонки непредсказуемо — на 360 столбиком с неровными
 * зазорами, на 768 в раскладку 2+2+1. `grid` фиксирует раскладку явно на
 * каждом пороге: одна колонка на 360, две на `md`, марка + 4 колонки одной
 * строкой на `lg` (там же, где включается остальной десктоп).
 */
const RESTAURANT_LINKS = {
  connect: BUSINESS_URL,
  pricing: PRICING_URL,
  cabinet: CABINET_URL,
} as const;

export interface SiteFooterProps {
  /** Активный язык. Меняется здесь же, в нижней строке подвала. */
  locale?: WebLocale;
  onLocaleChange?: (locale: WebLocale) => void;
  className?: string;
}

/**
 * Ключи словаря `t.web.footer.company`/`.help`, у которых уже есть настоящая
 * страница платформы (T4, `GET /pages/:slug`). «Блог» — единственный ключ
 * этих двух колонок без слуга, остаётся `href="#"` (T3).
 */
const FOOTER_KEY_TO_PAGE_SLUG = {
  about: "about",
  jobs: "jobs",
  contacts: "contacts",
  how: "how-it-works",
  cancel: "cancellation",
  offer: "offer",
  privacy: "privacy",
} as const;

/**
 * Ключи словаря `t.web.footer.guests`, у которых уже есть настоящий роут —
 * но НЕ через систему текстовых страниц платформы, поэтому отдельная карта, а
 * не запись в `FOOTER_KEY_TO_PAGE_SLUG`.
 *
 * Ключ сужен до полей колонки «Гостям» (минус `title`): голый `string` пропустил
 * бы ключ любой другой колонки, случайно подхватив чужой href молча.
 */
const FOOTER_KEY_TO_HREF: Partial<Record<Exclude<keyof Dictionary["web"]["footer"]["guests"], "title">, string>> = {
  venues: "/venues",
  afisha: EVENTS_PATH,
  guide: "/guide",
  myBookings: sectionHref("bookings"),
  favorites: sectionHref("favorites"),
};

const LOCALES: ReadonlyArray<{ code: WebLocale; label: string }> = [
  { code: "kk", label: WEB_LOCALE_LABELS.kk },
  { code: "ru", label: WEB_LOCALE_LABELS.ru },
  { code: "en", label: WEB_LOCALE_LABELS.en },
];

export function SiteFooter({ locale = "ru", onLocaleChange, className }: SiteFooterProps) {
  const t = useT();
  const columns = [t.web.footer.guests, t.web.footer.restaurants, t.web.footer.company, t.web.footer.help];

  return (
    <footer className={cx("w-full bg-inverse pb-8 pt-16", className)}>
      <Container className="flex flex-col gap-12">
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-[320px_repeat(4,1fr)]">
          <div className="flex w-full flex-col gap-3.5 lg:max-w-[320px]">
            <p className="text-[24px] font-bold leading-8 tracking-[-0.4px] text-ink-on-inverse">
              {t.web.header.brand}
            </p>
            <p className="text-[14px] leading-[22px] text-ink-on-inverse-muted">{t.web.footer.tagline}</p>
            <ul aria-label={t.web.footer.social.title} className="flex items-center gap-2.5">
              {[t.web.footer.social.instagram, t.web.footer.social.telegram, t.web.footer.social.whatsapp].map(
                (name) => (
                  <li key={name}>
                    <a
                      href="#"
                      aria-label={name}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-on-inverse-surface text-[16px] leading-5 text-ink-on-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {/* Первая буква — временная заглушка вместо значка: в
                          макете здесь стоят символы-плейсхолдеры (◎ ☏ ▣), а
                          настоящих иконок соцсетей в веб-ките нет. */}
                      <span aria-hidden="true">{name.slice(0, 1)}</span>
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>

          {columns.map((column) => {
            // «Ресторанам» — единственная колонка с внешними ссылками
            // (см. RESTAURANT_LINKS выше); ключ "support" в словаре
            // остаётся, но сюда сознательно не входит (T3).
            const isRestaurants = column === t.web.footer.restaurants;
            const restaurantEntries = isRestaurants
              ? (Object.keys(RESTAURANT_LINKS) as Array<keyof typeof RESTAURANT_LINKS>).map((key) => ({
                  key,
                  label: t.web.footer.restaurants[key],
                  href: RESTAURANT_LINKS[key],
                }))
              : [];
            const linkClassName =
              "text-[14px] leading-[22px] text-ink-on-inverse-muted hover:text-ink-on-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

            return (
              <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
                <h2 className="text-[15px] font-semibold leading-[22px] text-ink-on-inverse">{column.title}</h2>
                <ul className="flex flex-col gap-3">
                  {isRestaurants
                    ? restaurantEntries.map(({ key, label, href }) => (
                        <li key={key}>
                          <ExternalLink href={href} label={label} className={linkClassName}>
                            {label}
                          </ExternalLink>
                        </li>
                      ))
                    : Object.entries(column)
                        .filter(([key]) => key !== "title")
                        .map(([key, label]) => {
                          const slug = FOOTER_KEY_TO_PAGE_SLUG[key as keyof typeof FOOTER_KEY_TO_PAGE_SLUG];
                          const directHref =
                            FOOTER_KEY_TO_HREF[key as keyof typeof FOOTER_KEY_TO_HREF];
                          const href = slug ? SITE_PAGE_PATHS[slug] : directHref;
                          return (
                            <li key={key}>
                              {href ? (
                                <Link href={href} className={linkClassName}>
                                  {label}
                                </Link>
                              ) : (
                                <a href="#" className={linkClassName}>
                                  {label}
                                </a>
                              )}
                            </li>
                          );
                        })}
                </ul>
              </nav>
            );
          })}
        </div>

        {/* Линия и нижняя строка — такие же дети подвала, как колонки: между
            всеми тремя один просвет 48 (405 = 64 + 192 + 48 + 1 + 48 + 20 + 32,
            узел 3525:15109). Раньше линия и строка стояли через 32. */}
        <div className="flex flex-col gap-12">
          <div className="h-px w-full bg-on-inverse-line" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[13px] leading-5 text-ink-tertiary">{t.web.footer.copyright}</p>
            <ul aria-label={t.web.footer.languageLabel} className="flex items-center gap-4">
              {LOCALES.map((item) => {
                const active = item.code === locale;
                return (
                  <li key={item.code}>
                    <button
                      type="button"
                      lang={item.code}
                      aria-current={active ? "true" : undefined}
                      onClick={() => onLocaleChange?.(item.code)}
                      className={cx(
                        "text-[13px] leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        active ? "font-semibold text-ink-on-inverse" : "text-ink-tertiary hover:text-ink-on-inverse",
                      )}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Container>
    </footer>
  );
}
