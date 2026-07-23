import { colors, hitSlop, radius } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

interface IconButtonProps {
  /** Text glyph placeholder (e.g. "←", "✕", "♡") until a real icon set ships. */
  glyph: string;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: "onLight" | "onImage";
}

/**
 * Minimum 44x44 touch target icon-only button with a mandatory
 * accessibilityLabel — every icon button in the app must go through this.
 */
export function IconButton({ glyph, onPress, accessibilityLabel, tone = "onLight" }: IconButtonProps) {
  const onImage = tone === "onImage";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        onImage ? styles.onImage : styles.onLight,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.glyph, onImage && styles.glyphOnImage]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: hitSlop.minTouchTarget,
    height: hitSlop.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  onLight: {
    backgroundColor: colors.neutral[50],
  },
  onImage: {
    backgroundColor: colors.overlay.scrim,
  },
  pressed: {
    opacity: 0.7,
  },
  glyph: {
    fontSize: 18,
    color: colors.neutral[900],
  },
  glyphOnImage: {
    color: colors.neutral[0],
  },
});
