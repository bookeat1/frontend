import React from "react";
import { View, type ViewProps } from "react-native";

/**
 * Web (react-native-web) implementation.
 *
 * There is no compositor-level glass material in a browser. Both
 * availability checks below are hardcoded `false`, so `NavPanel` in
 * `BottomNavBar.tsx` (`isLiquidGlassAvailable() && isGlassEffectAPIAvailable()`)
 * never actually mounts `GlassView` on web — it falls straight to the same
 * plain-`View` fallback Android and pre-26 iOS already use. `GlassView`
 * itself is exported anyway so the import type-checks and Metro has
 * something to resolve; matches ADR-046 ("expo-glass-effect → обычный
 * View").
 */

export interface GlassViewProps extends ViewProps {
  glassEffectStyle?: string | { style: string; animate?: boolean; animationDuration?: number };
  tintColor?: string;
  isInteractive?: boolean;
  colorScheme?: "auto" | "light" | "dark";
}

export function GlassView({
  glassEffectStyle: _glassEffectStyle,
  tintColor: _tintColor,
  isInteractive: _isInteractive,
  colorScheme: _colorScheme,
  ...viewProps
}: GlassViewProps) {
  return <View {...viewProps} />;
}

export function isGlassEffectAPIAvailable(): boolean {
  return false;
}

export function isLiquidGlassAvailable(): boolean {
  return false;
}
