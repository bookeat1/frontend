import { colors } from "@bookeat/design-tokens";
import { CormorantGaramond_700Bold } from "@expo-google-fonts/cormorant-garamond";
import { Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
} from "@expo-google-fonts/noto-sans";
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold_Italic,
} from "@expo-google-fonts/playfair-display";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AnalyticsProvider } from "../src/lib/analytics-provider";
import { AuthProvider } from "../src/lib/auth";
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
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background.surface },
                }}
              />
            </PushProvider>
            </AnalyticsProvider>
            </AuthProvider>
          </RepositoryProvider>
        </QueryClientProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
