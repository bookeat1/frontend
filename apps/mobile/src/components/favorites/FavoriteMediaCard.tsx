import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FavoriteButton } from "../explore/FavoriteButton";
import { PhotoView } from "../PhotoView";
import { TagChips } from "../TagChips";

/**
 * Карточка сохранённого СОБЫТИЯ или АКЦИИ на экране «Избранные»
 * (Figma 602:3630).
 *
 * Одна карточка на два вида, а не две почти одинаковые: геометрия у них
 * общая — фотография 359×148 с отступом 8 от краёв экрана, сердечко 24×24 в
 * 12/12 от её правого верхнего угла, текстовый блок с отступом 16, название и
 * одна строка «когда». Различие ровно одно — у события есть чипы-теги, у акции
 * их нет, и это здесь опциональное свойство, а не второй файл.
 *
 * Карточка заведения к этой не сводится: там ещё описание в две строки и чипы
 * кухни/чека, и она уже существует — это обычная каталожная `RestaurantCard`.
 *
 * Полностью controlled: своего состояния сердечка нет, о нём знает вызывающий
 * (хуки useEventFavorite / usePromoFavorite).
 */
export function FavoriteMediaCard({
  title,
  meta,
  coverImageUrl,
  tags,
  badge,
  favorite,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  /** Одна строка под названием: «16 мая · 13:00» у события, «до 6 сентября» у
   * акции. Пустая строка — строки просто нет. */
  meta: string;
  coverImageUrl: string | null;
  /** Теги события. Пусто/не задано — ряд чипов не рисуется. */
  tags?: string[];
  /** Красный бейдж «−30%» поверх фотографии (только у акции со скидкой). */
  badge?: string;
  favorite: { isFavorite: boolean; onToggle: () => void };
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <PhotoView
          uri={coverImageUrl ?? undefined}
          style={styles.image}
          decorative
          placeholderIconSize={32}
        />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {/* Сердечко — отдельная кнопка ВНУТРИ карточки-кнопки: тап по нему
            сохраняет/убирает, тап мимо него открывает карточку. Слой повторяет
            границы самой фотографии (обёртка шире неё на 8), поэтому 12/12
            отсчитываются от угла снимка, как в макете. */}
        <View style={styles.photoOverlayLayer} pointerEvents="box-none">
          <FavoriteButton
            itemName={title}
            isFavorite={favorite.isFavorite}
            onToggle={favorite.onToggle}
          />
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
            {meta}
          </Text>
        ) : null}
        <TagChips tags={tags ?? []} size="compact" />
      </View>
    </Pressable>
  );
}

const IMAGE_HEIGHT = 148;

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.9,
  },
  imageWrap: {
    // Фотография отступает от краёв на 8, подпись под ней — на 16: та же
    // геометрия, что у каталожной карточки заведения в этом же списке.
    paddingHorizontal: spacing.sm,
  },
  image: {
    width: "100%",
    height: IMAGE_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  photoOverlayLayer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
  },
  badge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.sm + spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  badgeText: {
    ...typography.captionMedium,
    color: colors.text.onBrand,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  meta: {
    ...typography.body,
    color: colors.text.primary,
  },
});
