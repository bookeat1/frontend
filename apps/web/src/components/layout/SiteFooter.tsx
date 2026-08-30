"use client";

import { Container } from "@web/components/layout/Container";
import { cx } from "@web/lib/cx";
import { t } from "@web/lib/i18n";

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
 */
export interface SiteFooterProps {
  /** Активный язык. Переключение появится вместе с экранами. */
  locale?: "ru" | "kk" | "en";
  onLocaleChange?: (locale: "ru" | "kk" | "en") => void;
  className?: string;
}

const LOCALES: ReadonlyArray<{ code: "ru" | "kk" | "en"; label: string }> = [
  // Собственное имя языка не переводится: «Қазақша» читается одинаково в
  // любой локали. Поэтому подписи стоят здесь, а не в словаре.
  { code: "kk", label: "Қазақша" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

export function SiteFooter({ locale = "ru", onLocaleChange, className }: SiteFooterProps) {
  const columns = [t.web.footer.guests, t.web.footer.restaurants, t.web.footer.company, t.web.footer.help];

  return (
    <footer className={cx("w-full bg-inverse pb-8 pt-16", className)}>
      <Container className="flex flex-col gap-12">
        <div className="flex flex-wrap justify-between gap-gutter">
          <div className="flex w-full max-w-[320px] flex-col gap-3.5">
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

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
              <h2 className="text-[15px] font-semibold leading-[22px] text-ink-on-inverse">{column.title}</h2>
              <ul className="flex flex-col gap-3">
                {Object.entries(column)
                  .filter(([key]) => key !== "title")
                  .map(([key, label]) => (
                    <li key={key}>
                      <a
                        href="#"
                        className="text-[14px] leading-[22px] text-ink-on-inverse-muted hover:text-ink-on-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-8">
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
