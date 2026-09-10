import { colors } from "@bookeat/design-tokens";
import { CormorantGaramond_700Bold } from "@expo-google-fonts/cormorant-garamond/700Bold";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Montserrat_400Regular } from "@expo-google-fonts/montserrat/400Regular";
import { Montserrat_500Medium } from "@expo-google-fonts/montserrat/500Medium";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat/700Bold";
import { NotoSans_400Regular } from "@expo-google-fonts/noto-sans/400Regular";
import { NotoSans_500Medium } from "@expo-google-fonts/noto-sans/500Medium";
import { NotoSans_600SemiBold } from "@expo-google-fonts/noto-sans/600SemiBold";
import { NotoSans_700Bold } from "@expo-google-fonts/noto-sans/700Bold";
import { PlayfairDisplay_400Regular_Italic } from "@expo-google-fonts/playfair-display/400Regular_Italic";
import { PlayfairDisplay_700Bold_Italic } from "@expo-google-fonts/playfair-display/700Bold_Italic";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppUpdateGate } from "../src/components/AppUpdateGate";
import { AnalyticsProvider } from "../src/lib/analytics-provider";
import { AuthProvider } from "../src/lib/auth";
import { isDetourConfigured } from "../src/lib/detour";
import { DetourLinkRouter } from "../src/lib/detour-link-router";
import { DetourProviderGate } from "../src/lib/detour-provider-gate";
import { bootstrapLocale, LocaleProvider } from "../src/lib/locale";
import { PushProvider } from "../src/lib/push";
import { RepositoryProvider } from "../src/lib/repository";
import { ScreenViewTracker } from "../src/lib/screen-view-tracker";
import { queryClient } from "../src/lib/queryClient";

// Apply the persisted language to the i18n module as early as the JS bundle
// allows — at entry-module evaluation, before RootLayout (and the route screens
// it hosts) render. Route screens are imported lazily by expo-router, so the
// ones reached after this async read resolves get the right language on a cold
// start; a language change reloads the bundle so the rest re-resolve too. Kept
// module-scope (not inside the component) so it fires once, ahead of render.
void bootstrapLocale();

export default function RootLayout() {
  // MW-5 (2026-09-08): every `@expo-google-fonts/<family>` import above is a
  // SUBPATH (`.../noto-sans/400Regular`), never the family barrel
  // (`.../noto-sans`). The barrel's `index.js` does a plain top-level
  // `require()` for EVERY weight the family ships — regular AND italic, 100
  // through 900 — so importing even one named export from it pulled all of
  // them into the web export: measured 76 of 94 font files actually
  // referenced in the bundle for the 12 weights used here, ~30 MB raw /
  // ~13 MB gzip, by far the largest chunk of the whole export (bigger than
  // the JS bundle itself). The subpath's own `index.js` `require()`s just
  // that one file. Add a font weight here ONLY via its subpath — reaching
  // for the barrel import again silently brings the other ~80 files back.
  const [fontsLoaded, fontError] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    Inter_600SemiBold,
    // Playfair Display в ДВУХ начертаниях, у каждого своя роль: Bold Italic —
    // названия событий в «Афише» (узлы 3452:13369, 3452:13244), имя заведения
    // на карточке списка и в шапке заведения; Italic (400) — журнальные
    // заголовки гастрогида «Editorial v2» (3192:6246).
    PlayfairDisplay_700Bold_Italic,
    PlayfairDisplay_400Regular_Italic,
    // Страница бренда в гастрогиде (3424:3927) — Cormorant Garamond +
    // Montserrat. Эти разделы живут на своих экранах, но грузятся здесь
    // вместе с остальными: `useFonts` держит сплэш до готовности, и
    // подгружать гарнитуру на входе в раздел значило бы показать там
    // системный шрифт.
    CormorantGaramond_700Bold,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  // Keep the native splash screen up (managed by expo-router) until the real
  // typeface is ready — the design specifies Noto Sans / Inter throughout, plus
  // Playfair Display for event and venue titles and Playfair / Cormorant /
  // Montserrat inside the gastroguide, so we never want to flash the system
  // font first. A new face goes INTO this same `useFonts` call, never
  // into a second one: the splash is held on this one flag.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* DetourProviderGate (deferred deep linking, Software Mansion) sits
          outermost: it owns no session, only device/link state, and
          <DetourProvider>'s single documented instance-per-app requirement
          is easiest to keep if nothing else wraps it. `<DetourProvider>`
          itself no-ops on web (the package's own Platform.OS check); on
          native the SDK has NO built-in no-op for a missing/empty
          apiKey/appID (it still fires an automatic retention event on every
          cold start), so DetourProviderGate skips mounting it at all in that
          case — see src/lib/detour.ts and detour-provider-gate.tsx. */}
      <DetourProviderGate>
        <SafeAreaProvider>
          {/* LocaleProvider sits at the top so every screen (and every provider
              below) can read the current language. It owns no session and no
              query, only the chosen locale + its persisted value. */}
          <LocaleProvider>
          <QueryClientProvider client={queryClient}>
            <RepositoryProvider>
              {/* AuthProvider sits INSIDE RepositoryProvider on purpose: it
                  writes the token cell that the repository's getToken closure
                  reads, and mounting it here means the whole app (not just the
                  booking flow) can read the session. */}
              <AuthProvider>
              {/* AnalyticsProvider sits inside AuthProvider so it can read the
                  session: it brings Amplitude up once and keeps the analytics
                  identity in sync (identify on sign-in, reset on sign-out). It
                  renders nothing and no-ops entirely when no key is configured. */}
              <AnalyticsProvider>
              {/* PushProvider needs BOTH the session (whose account the token is
                  registered against) and the router (a tapped notification opens
                  the booking), so it sits inside AuthProvider and around the
                  Stack. It renders nothing and starts nothing on an unsupported
                  runtime. */}
              <PushProvider>
                <StatusBar style="dark" />
                {/* Просмотры экранов — одним местом на всё приложение. Рисует
                    null; отдельным узлом, а не хуком в AnalyticsProvider, чтобы
                    переход по навигации не перерисовывал весь Stack. */}
                <ScreenViewTracker />
                {/* Deferred Detour link → route, once resolved. Renders null;
                    a separate node so it re-renders on its own context change,
                    not the whole Stack (same reasoning as ScreenViewTracker).
                    Reads useDetourContext(), which throws outside a mounted
                    <DetourProvider> — gated the same way DetourProviderGate
                    decides whether to mount one. */}
                {isDetourConfigured && <DetourLinkRouter />}
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background.surface },
                  }}
                />
                {/* «Доступна новая версия» — ПОСЛЕ Stack, чтобы окно легло
                    поверх любого экрана: жёсткий режим обязан накрывать и тот,
                    на который гость пришёл по пуш-уведомлению. Пока показывать
                    нечего, рисует null. */}
                <AppUpdateGate />
              </PushProvider>
              </AnalyticsProvider>
              </AuthProvider>
            </RepositoryProvider>
          </QueryClientProvider>
          </LocaleProvider>
        </SafeAreaProvider>
      </DetourProviderGate>
    </GestureHandlerRootView>
  );
}
