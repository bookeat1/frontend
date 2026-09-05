"use client";

import type { ReactNode } from "react";

import { SiteFooter } from "@web/components/layout/SiteFooter";
import { SiteHeader, type NavKey } from "@web/components/layout/SiteHeader";
import { useAuth } from "@web/lib/auth";
import { useCity } from "@web/lib/city";
import { useLocale } from "@web/lib/locale";

/**
 * Обвязка страницы: шапка, содержимое, подвал.
 *
 * Здесь же сходятся два общих для всего сайта состояния — город и язык. Иначе
 * каждая страница подключала бы их сама, и рано или поздно одна из них забыла
 * бы прокинуть смену города в шапку.
 *
 * Здесь же живёт сессия гостя: шапка показывает либо «Войти»/«Регистрация»
 * (обе ведут на `/login`), либо имя вошедшего и «Выйти».
 */
/**
 * Фон содержимого между шапкой и подвалом. Главная, каталог и заведение
 * нарисованы на белом (`background/canvas`); кадры потока бронирования
 * (`3525:14815` и `3525:15019`) — на `background/subtle` (#F8F8F8), чтобы
 * белые карточки читались на подложке. Шапка и подвал от этого не зависят.
 */
export type ChromeTone = "canvas" | "subtle";

export function SiteChrome({
  active,
  tone = "canvas",
  children,
}: {
  active?: NavKey;
  tone?: ChromeTone;
  children: ReactNode;
}) {
  const { city, cities, setCity } = useCity();
  const { locale, setLocale, t } = useLocale();
  const { user, signedIn, isLoading, signOut } = useAuth();

  // Пока сессия не прочитана, шапка не показывает НИЧЕГО про вход: мигнуть
  // «Войти» вошедшему гостю хуже, чем задержать кнопку на один кадр.
  // Профиль мог не приехать (сеть) — тогда вместо имени обобщённая подпись,
  // а не пустая строка на месте кнопок.
  const account = isLoading
    ? undefined
    : signedIn
      ? { name: user?.fullName?.trim() || t.web.header.account }
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader
        activeKey={active}
        city={city}
        cities={cities}
        onCityChange={setCity}
        account={account}
        onSignOut={signOut}
      />
      <main className={tone === "subtle" ? "flex-1 bg-subtle" : "flex-1"}>{children}</main>
      <SiteFooter locale={locale} onLocaleChange={setLocale} />
    </div>
  );
}
