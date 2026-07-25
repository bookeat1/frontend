import { colors, spacing } from "@bookeat/design-tokens";
import React, { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Heart } from "../icons";
import { exploreCopy } from "./copy";

/**
 * Heart overlaid on the top-right corner of an Explore card photo.
 *
 * NOT built on `IconButton` on purpose: that one renders a single fixed
 * `weight="regular"` glyph with no selected state, and a toggle needs
 * `accessibilityState.checked` plus a filled glyph. It keeps IconButton's
 * rules — 44pt target (24pt glyph + 10pt hitSlop on each side) and a
 * mandatory label.
 *
 * PLACEHOLDER BEHAVIOUR: the state is local and dies with the component.
 * Favourites exist in backend-core but `RestaurantRepository` exposes no
 * method for them — see the `favourites` note in ./placeholder.ts. Wire
 * `isFavorite`/`onToggle` from the caller when it does.
 */
export function FavoriteButton({ itemName }: { itemName: string }) {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ checked: isFavorite }}
      accessibilityLabel={
        isFavorite ? exploreCopy.favoriteRemove(itemName) : exploreCopy.favoriteAdd(itemName)
      }
      onPress={() => setIsFavorite((prev) => !prev)}
      hitSlop={10}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Heart
        size={24}
        weight="fill"
        color={isFavorite ? colors.brand.favorite : colors.text.onDark}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    // 24 glyph + hitSlop 10 = 44 in every direction, per the touch-target rule.
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    // The heart sits on an unpredictable photo; a soft drop shadow is what
    // keeps a white heart visible over a bright dish.
    shadowColor: colors.overlay.scrim,
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  pressed: {
    opacity: 0.7,
  },
});
