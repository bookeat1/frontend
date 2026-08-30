"use client";

import type { ReactNode } from "react";

import { SiteFooter } from "@web/components/layout/SiteFooter";
import { SiteHeader, type NavKey } from "@web/components/layout/SiteHeader";
import { useCity } from "@web/lib/city";
import { useLocale } from "@web/lib/locale";

/**
 * Обвязка страницы: шапка, содержимое, подвал.
 *
 * Здесь же сходятся два общих для всего сайта состояния — город и язык. Иначе
 * каждая страница подключала бы их сама, и рано или поздно одна из них забыла
 * бы прокинуть смену города в шапку.
 *
 * Кнопки «Войти» и «Регистрация» из макета пока НИЧЕГО не делают: авторизации
 * в вебе нет. Обработчик им не передаётся сознательно — кнопка, которая
 * открывает пустую модалку, врёт заметнее, чем кнопка, которая ничего не
 * обещает.
 */
export function SiteChrome({ active, children }: { active?: NavKey; children: ReactNode }) {
  const { city, cities, setCity } = useCity();
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader activeKey={active} city={city} cities={cities} onCityChange={setCity} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} onLocaleChange={setLocale} />
    </div>
  );
}
