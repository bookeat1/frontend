"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { webProfile } from "@bookeat/design-tokens";

import { Card } from "@web/components/ui/Card";
import { HeartIcon } from "@web/components/ui/HeartIcon";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Меню разделов личного кабинета — узел 3525:15171: белая карточка радиуса
 * 24 (`webRadius.card`, как у `Card`) с паддингом 8, пункты 48 высотой через
 * 4, паддинг 14 по горизонтали, значок 24 и подпись 15/22 через 12. Выбранный
 * пункт — заливка `brand/50`, радиус 16 и SemiBold фирменным; остальные —
 * радиус 12 без заливки. Ширина 252 — только с `lg`; ниже меню растягивается
 * на всю колонку, как список «Профиля» в приложении.
 *
 * Три пункта — ССЫЛКИ на разделы одной страницы (`/profile?section=…`):
 * адрес раздела можно открыть в новой вкладке и вернуться назад кнопкой
 * браузера. «Выйти» — ДЕЙСТВИЕ, поэтому это `<button>`, а не ссылка на
 * несуществующий адрес.
 *
 * Значки нарисованы здесь как inline-SVG по описанию макета (24 px, контур
 * 1.5, как у значков шапки): выгрузки контуров из Figma в `design-specs` нет.
 */
export type ProfileSection = "bookings" | "favorites" | "settings";

export const PROFILE_SECTIONS: readonly ProfileSection[] = ["bookings", "favorites", "settings"];

export const SECTION_PARAM = "section";

export function sectionHref(section: ProfileSection): string {
  return section === "bookings" ? "/profile" : `/profile?${SECTION_PARAM}=${section}`;
}

export function parseSection(raw: string | null): ProfileSection {
  return (PROFILE_SECTIONS as readonly string[]).includes(raw ?? "")
    ? (raw as ProfileSection)
    : "bookings";
}

export interface ProfileNavProps {
  active: ProfileSection;
  onSignOut: () => void;
  /** Выход уже идёт — кнопка выключена, второй клик безвреден. */
  signingOut?: boolean;
  className?: string;
}

const ICON_SIZE = webProfile.nav.item.iconSize;

const ICONS: Record<ProfileSection, ReactNode> = {
  bookings: <ClipboardCheckIcon />,
  favorites: <HeartIcon filled={false} size={ICON_SIZE} />,
  settings: <SettingsIcon />,
};

const itemBase =
  "flex h-profile-nav-item w-full items-center gap-profile-nav-item-gap px-profile-nav-item-x text-left text-profile-nav transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const itemIdle = "rounded-md text-ink hover:bg-subtle";
const itemActive = "rounded-lg bg-brand-subtle font-semibold text-brand-text";

export function ProfileNav({ active, onSignOut, signingOut = false, className }: ProfileNavProps) {
  const t = useT();
  const texts = t.web.profile.nav;

  return (
    <Card className={cx("w-full shrink-0 lg:w-profile-nav", className)}>
      <nav aria-label={texts.label} className="p-profile-nav-p">
        <ul className="flex flex-col gap-profile-nav-gap">
          {PROFILE_SECTIONS.map((section) => {
            const isActive = section === active;
            return (
              <li key={section}>
                <Link
                  href={sectionHref(section)}
                  aria-current={isActive ? "page" : undefined}
                  className={cx(itemBase, isActive ? itemActive : itemIdle)}
                >
                  <span aria-hidden="true" className="inline-flex h-profile-nav-icon w-profile-nav-icon shrink-0 items-center justify-center">
                    {ICONS[section]}
                  </span>
                  <span className="min-w-0 truncate">{texts[section]}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className={cx(itemBase, itemIdle, "disabled:cursor-not-allowed disabled:text-ink-disabled")}
            >
              <span aria-hidden="true" className="inline-flex h-profile-nav-icon w-profile-nav-icon shrink-0 items-center justify-center">
                <SignOutIcon />
              </span>
              <span className="min-w-0 truncate">{texts.signOut}</span>
            </button>
          </li>
        </ul>
      </nav>
    </Card>
  );
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** «Linear / Notes / Clipboard Check» (узел 3525:15173). */
function ClipboardCheckIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...strokeProps}>
      <rect x="4.8" y="4.8" width="14.4" height="14.4" rx="3" />
      <path d="M9.6 4.8h4.8v3.2H9.6z" />
      <path d="M8.8 12.8l2 2 4.4-4.4" />
    </svg>
  );
}

/** «Linear / Settings, Fine Tuning / Settings» (узел 3525:15183). */
function SettingsIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...strokeProps}>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M10.4 4h3.2l.5 2.2 1.9 1.1 2.1-.8 1.6 2.8-1.7 1.5v2.4l1.7 1.5-1.6 2.8-2.1-.8-1.9 1.1-.5 2.2h-3.2l-.5-2.2-1.9-1.1-2.1.8-1.6-2.8 1.7-1.5v-2.4L4.3 9.3l1.6-2.8 2.1.8 1.9-1.1z" />
    </svg>
  );
}

/** «Linear / Arrows Action / Login» (узел 3525:15188) — в меню он значит «Выйти». */
function SignOutIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...strokeProps}>
      <path d="M13.6 4h2.4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2.4" />
      <path d="M5 12h9" />
      <path d="M10.4 8.4 14 12l-3.6 3.6" />
    </svg>
  );
}
