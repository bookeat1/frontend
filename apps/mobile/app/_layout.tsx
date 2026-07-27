import { colors } from "@bookeat/design-tokens";
import { Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
} from "@expo-google-fonts/noto-sans";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/lib/auth";
import { PushProvider } from "../src/lib/push";
import { RepositoryProvider } from "../src/lib/repository";
import { queryClient } from "../src/lib/queryClient";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    Inter_600SemiBold,
  });

  // Keep the native splash screen up (managed by expo-router) until the real
  // typeface is ready — the design specifies Noto Sans / Inter throughout,
  // so we never want to flash the system font first.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RepositoryProvider>
            {/* AuthProvider sits INSIDE RepositoryProvider on purpose: it
                writes the token cell that the repository's getToken closure
                reads, and mounting it here means the whole app (not just the
                booking flow) can read the session. */}
            <AuthProvider>
            {/* PushProvider needs BOTH the session (whose account the token is
                registered against) and the router (a tapped notification opens
                the booking), so it sits inside AuthProvider and around the
                Stack. It renders nothing and starts nothing on an unsupported
                runtime. */}
            <PushProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background.surface },
                }}
              />
            </PushProvider>
            </AuthProvider>
          </RepositoryProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
