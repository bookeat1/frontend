import { getDictionary, isRTL, setCurrentLocale, type Dictionary, type Locale } from "@bookeat/i18n";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager } from "react-native";
import { reloadApp } from "./reload-app";

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

/**
 * Applies a locale to the i18n MODULE, not to React: it points the shared
 * `getDictionary()` (no-arg) default at `locale` and flips text direction.
 *
 * This is what makes the language choice reach the ~40 screens and components
 * that resolve their dictionary once at module scope (`const t =
 * getDictionary()`) and never see a React context. After this runs, any
 * getDictionary() evaluated LATER answers in the chosen language.
 */
function applyLocaleToModule(locale: Locale): void {
  setCurrentLocale(locale);
  applyDirection(locale);
}

// The persisted read happens at most once per JS lifetime, shared between the
// app-entry bootstrap (which fires it as early as possible) and the provider
// (which needs the result for its initial React state). Caching the promise
// keeps those two from racing on SecureStore.
let bootstrapPromise: Promise<Locale> | null = null;

/**
 * Reads the persisted locale and applies it to the i18n module BEFORE the first
 * screen renders. Call this at app-entry module scope (app/_layout.tsx) so the
 * shared `getDictionary()` default is correct as early as the async storage
 * read allows — the earlier it runs, the more module-scope screens are lazily
 * imported AFTER it and thus pick up the right language on a cold start.
 *
 * SecureStore has no synchronous read, so a screen whose module is evaluated in
 * the very first tick (before this resolves) still captures Russian; a reload
 * after a language change re-runs module init once this has already applied the
 * stored value, which is what closes that gap. Resolves to the applied locale
 * (the default when nothing valid is stored).
 */
export function bootstrapLocale(): Promise<Locale> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      const stored = await SecureStore.getItemAsync(LOCALE_KEY);
      if (isLocale(stored)) {
        applyLocaleToModule(stored);
        return stored;
      }
    } catch {
      // No persisted locale (or storage unavailable) — keep the default.
    }
    return DEFAULT_LOCALE;
  })();
  return bootstrapPromise;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate once from storage via the shared bootstrap (already kicked off at
  // app entry). A missing or unrecognised value stays on the Russian default
  // rather than throwing. `applyLocaleToModule` has already run inside
  // bootstrapLocale for module-scope screens; here we mirror it into React
  // state so the new, context-aware screens re-render too.
  useEffect(() => {
    let cancelled = false;
    void bootstrapLocale().then((stored) => {
      if (cancelled || stored === DEFAULT_LOCALE) return;
      setLocaleState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      // React-level switch first: screens on useLocale() update immediately,
      // and the choice is not lost if the reload below is a no-op.
      setLocaleState(next);
      applyLocaleToModule(next);
      // Persist BEFORE reloading so the fresh JS context reads the new value.
      // Await the write so a reload cannot beat it to storage; a failed write
      // just means the choice does not survive a restart, not a blocked switch.
      void (async () => {
        try {
          await SecureStore.setItemAsync(LOCALE_KEY, next);
        } catch {
          // Storage unavailable (e.g. web) — proceed anyway.
        }
        // Reload so every module-scope `getDictionary()` re-resolves against
        // `next` and the RTL flip takes effect. No-ops (with a console note) in
        // release builds without expo-updates — see reloadApp.
        reloadApp();
      })();
    },
    [locale],
  );

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
