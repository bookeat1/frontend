import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Heart } from "../icons";

const t = getDictionary();

/**
 * Heart overlaid on the top-right corner of an Explore card photo.
 *
 * NOT built on `IconButton` on purpose: that one renders a single fixed
 * `weight="regular"` glyph with no selected state, and a toggle needs
 * `accessibilityState.checked` plus a filled glyph. It keeps IconButton's
 * rules — 44pt target (24pt glyph + 10pt hitSlop on each side) and a
 * mandatory label.
 *
 * Fully CONTROLLED: it owns no state at all — the caller decides what the
 * heart means (useRestaurantFavorite / useEventFavorite / usePromoFavorite,
 * each backed by its own real endpoint). A component that silently keeps its
 * own copy of the truth is how the heart used to lie.
 *
 * Рядом жил `InertFavoriteHeart` — нарисованное, но неактивное сердечко для
 * карточек, под которыми не было сущности с избранным. Оно удалено: у всех
 * трёх видов (заведение, событие, акция) эндпоинт избранного теперь есть.
 */
export function FavoriteButton({
  itemName,
  isFavorite,
  onToggle,
}: {
  itemName: string;
  isFavorite: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ checked: isFavorite }}
      accessibilityLabel={
        isFavorite ? t.explore.favoriteRemove(itemName) : t.explore.favoriteAdd(itemName)
      }
      onPress={onToggle}
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
