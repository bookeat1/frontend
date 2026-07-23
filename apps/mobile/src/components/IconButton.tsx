import { colors, hitSlop, radius } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import type { IconProps } from "./icons";

interface IconButtonProps {
  /** A Phosphor icon component from `./icons`, e.g. `ArrowLeft`. */
  icon: React.ComponentType<IconProps>;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: "onLight" | "onImage";
}

/**
 * Minimum 44x44 touch target icon-only button with a mandatory
 * accessibilityLabel — every icon button in the app must go through this.
 */
export function IconButton({ icon: Icon, onPress, accessibilityLabel, tone = "onLight" }: IconButtonProps) {
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
      <Icon size={24} color={onImage ? colors.text.onDark : colors.text.primary} weight="regular" />
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
    backgroundColor: "transparent",
  },
  onImage: {
    backgroundColor: colors.overlay.scrim,
  },
  pressed: {
    opacity: 0.7,
  },
});
