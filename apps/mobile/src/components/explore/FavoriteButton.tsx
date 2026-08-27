import { colors, listCard, radius, spacing } from "@bookeat/design-tokens";
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
  placement = "photo",
}: {
  itemName: string;
  isFavorite: boolean;
  onToggle: () => void;
  /**
   * `photo` (по умолчанию) — сердечко на снимке карточки ленты «Главной»:
   * 12/12 от угла, белая подложка 20% (node 3053:8506).
   *
   * `listCard` — сердечко на карточке вертикального списка нового вида:
   * 16/16 от угла, серая подложка 50% (node 3452:13346). Подложка ДРУГАЯ не
   * от вкуса: у новой карточки низ снимка почти чёрный от градиента, и белый
   * круг на ней светился бы пятном.
   *
   * Один компонент с одним числом, а не второе сердечко: смысл, метка для
   * скринридера и цель касания у них общие.
   */
  placement?: "photo" | "listCard";
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
      style={({ pressed }) => [
        styles.button,
        placement === "listCard" && styles.buttonListCard,
        pressed && styles.pressed,
      ]}
    >
      <Heart
        size={24}
        weight={isFavorite ? "fill" : "regular"}
        color={isFavorite ? colors.brand.favorite : colors.text.onDark}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Круглая полупрозрачная подложка 32x32 из макета (node 3053:8506):
  // rgba(255,255,255,0.2). Раньше сердечко лежало на фотографии голым, и его
  // читаемость держалась на тени; подложка решает ту же задачу честнее и
  // совпадает с макетом.
  //
  // Нативного размытия под ней НЕТ намеренно: на Android и iOS до 26 его не
  // существует, и половина устройств увидела бы серый круг вместо стеклянного.
  // Полупрозрачная заливка выглядит одинаково везде.
  button: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay.photoControl,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonListCard: {
    top: listCard.overlayButtonInset,
    right: listCard.overlayButtonInset,
    width: listCard.overlayButtonSize,
    height: listCard.overlayButtonSize,
    backgroundColor: colors.overlay.listCardControl,
  },
  pressed: {
    opacity: 0.7,
  },
});
