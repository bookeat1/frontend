import { colors, hitSlop, radius } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import type { IconProps } from "./icons";

interface IconButtonProps {
  /** A Phosphor icon component from `./icons`, e.g. `ArrowLeft`. */
  icon: React.ComponentType<IconProps>;
  onPress: () => void;
  accessibilityLabel: string;
  /**
   * `onLight` (default): dark glyph on a transparent button, for white
   * surfaces. `onImage`: white glyph on a dark scrim circle, for controls
   * placed over a photo. `onDark`: white glyph on a transparent button, for a
   * dark solid surface (the home header) where a scrim circle would be noise.
   */
  tone?: "onLight" | "onImage" | "onDark";
  /**
   * Makes this a TOGGLE: the glyph fills in the brand's favourite colour and
   * the button reports `accessibilityState.checked` to a screen reader.
   * Undefined (the default) = a plain action button with no checked state, so
   * every existing call site keeps its current behaviour.
   */
  selected?: boolean;
}

/**
 * Minimum 44x44 touch target icon-only button with a mandatory
 * accessibilityLabel — every icon button in the app must go through this.
 */
export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  tone = "onLight",
  selected,
}: IconButtonProps) {
  const onImage = tone === "onImage";
  const color = selected
    ? colors.brand.favorite
    : onImage || tone === "onDark"
      ? colors.text.onDark
      : colors.text.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        onImage ? styles.onImage : styles.onLight,
        pressed && styles.pressed,
      ]}
    >
      <Icon size={24} color={color} weight={selected ? "fill" : "regular"} />
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
