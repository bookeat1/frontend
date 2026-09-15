"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getDictionary, type Dictionary } from "@bookeat/i18n";

import { setApiLanguage } from "@web/lib/api";

/**
 * Языки, которые веб реально показывает. Мобильные локали (ko/hi/ar/zh/tr)
 * в `@bookeat/i18n` есть, но их веб-ветка не переведена, и предлагать их в
 * подвале значило бы обещать перевод, которого нет.
 */
export type WebLocale = "ru" | "kk" | "en";

export const WEB_LOCALES: readonly WebLocale[] = ["ru", "kk", "en"];

/** Ключ в localStorage. Выбор языка переживает перезагрузку страницы. */
const STORAGE_KEY = "bookeat.web.locale";

interface LocaleContextValue {
  locale: WebLocale;
  setLocale: (locale: WebLocale) => void;
  t: Dictionary;
}

/**
 * Значение по умолчанию — русский словарь. Благодаря ему компонент, вырванный
 * из провайдера (тест одной кнопки, витрина /kit), рисуется по-русски, а не
 * падает с «useLocale вне провайдера».
 */
const LocaleContext = createContext<LocaleContextValue>({
  locale: "ru",
  setLocale: () => {},
  t: getDictionary("ru"),
});

function isWebLocale(value: string | null): value is WebLocale {
  return value === "ru" || value === "kk" || value === "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Стартуем с "ru" и на сервере, и на клиенте: прочитать localStorage до
  // гидратации нельзя, а любое расхождение первой отрисовки — это ошибка
  // гидратации. Сохранённый язык применяется эффектом сразу после неё.
  const [locale, setLocaleState] = useState<WebLocale>("ru");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isWebLocale(stored)) setLocaleState(stored);
  }, []);

  useEffect(() => {
    // Язык интерфейса И язык запроса — одно и то же значение: сервер переводит
    // содержимое по `Accept-Language` (названия кухонь, удобств, событий).
    setApiLanguage(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: WebLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: getDictionary(locale) }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** Короткая форма для компонентов, которым нужен только словарь. */
export function useT(): Dictionary {
  return useContext(LocaleContext).t;
}
