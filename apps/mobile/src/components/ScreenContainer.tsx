import { colors, spacing } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Consistent screen padding + safe-area handling. All top-level route
 * screens should render inside this instead of a bare View, so spacing
 * stays uniform and narrow devices (360px) get the same horizontal gutter.
 */
export function ScreenContainer({
  children,
  scroll = false,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={[styles.content, padded && styles.padded, scroll && styles.grow]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  grow: {
    flexGrow: 1,
  },
});
