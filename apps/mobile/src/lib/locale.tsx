import { getDictionary, isRTL, type Dictionary, type Locale } from "@bookeat/i18n";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager } from "react-native";

/**
 * The app's current interface language.
 *
 * Mirrors the shape of the other providers (auth.tsx / repository.tsx): a
 * React context wired once in RootLayout, hydrated from storage on mount,
 * defaulting to `ru`. Screens read the ready-to-use Dictionary through
 * `useLocale().dictionary` instead of calling `getDictionary()` at module
 * scope, so switching the language re-renders them with the new strings.
 *
 * Persistence reuses the only storage this app has — expo-secure-store (the
 * same module auth.tsx uses for the session). The locale is not a secret, but
 * adding AsyncStorage just for one string is not worth a new native dependency,
 * and on web SecureStore simply no-ops (the choice lasts the session, same as
 * the session itself).
 */
const LOCALE_KEY = "bookeat.locale.v1";
const DEFAULT_LOCALE: Locale = "ru";
const SUPPORTED: readonly Locale[] = ["ru", "kk", "en", "ko", "hi", "ar", "zh"];

interface LocaleContextValue {
  locale: Locale;
  /** The complete Dictionary for `locale` — a partial translation already
   * merged over the Russian base, so every key resolves. */
  dictionary: Dictionary;
  setLocale(locale: Locale): void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED as readonly string[]).includes(value);
}

/**
 * Applies text direction for the chosen locale.
 *
 * I18nManager flips the ENTIRE layout tree to right-to-left, but the flip only
 * takes full effect after a native reload (Expo: Updates.reloadAsync, or an
 * app restart) — React Native cannot re-mirror an already-rendered tree in
 * place. We wire the intent here so a fresh start in Arabic is laid out RTL; a
 * complete switch WHILE running needs that reload, which we deliberately do not
 * trigger from under the guest mid-tap. Left as a follow-up for the Arabic
 * translation task.
 */
function applyDirection(locale: Locale): void {
  const rtl = isRTL(locale);
  try {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  } catch {
    // I18nManager is absent / a no-op on web and under the test renderer.
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate once from storage. A missing or unrecognised value stays on the
  // Russian default rather than throwing.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(LOCALE_KEY);
        if (cancelled || !isLocale(stored)) return;
        setLocaleState(stored);
        applyDirection(stored);
      } catch {
        // No persisted locale (or storage unavailable) — keep the default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    applyDirection(next);
    // Fire-and-forget: a failed write just means the choice does not survive a
    // restart, which must not block the switch itself.
    void SecureStore.setItemAsync(LOCALE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dictionary: getDictionary(locale), setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return value;
}
