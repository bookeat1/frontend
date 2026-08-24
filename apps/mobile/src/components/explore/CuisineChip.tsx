import type { Cuisine } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { PhotoView } from "../PhotoView";
import { cuisinePhoto } from "./cuisine-photos";

const t = getDictionary();

/**
 * One circular cuisine chip in the «Выберите кухню» rail. Tapping it opens the
 * catalog filtered to that cuisine (see the home screen's onPickCuisine).
 *
 * Картинка берётся в двух местах. Сначала — снимок, лежащий в самом
 * приложении (cuisine-photos.ts): он показывается мгновенно и работает без
 * сети. Если своего снимка нет, подставляется фотография РЕАЛЬНОГО заведения
 * этой кухни из каталога (`photoUri`, см. useCuisinePhotos).
 *
 * Так ряд заполнен целиком, не требуя досылать сборку под каждую новую кухню:
 * на боевом каталоге из девяти кухонь своих снимков было два, и остальные семь
 * просто не показывались.
 */
export function CuisineChip({
  cuisine,
  onSelect,
  photoUri,
}: {
  cuisine: Cuisine;
  onSelect: (cuisine: Cuisine) => void;
  /** Фотография заведения этой кухни — запасной вариант, когда своего
   * снимка в приложении нет. */
  photoUri?: string;
}) {
  const photo = cuisinePhoto(cuisine.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.cuisineFilter(cuisine.name)}
      onPress={() => onSelect(cuisine)}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      {photo ? (
        <Image
          source={photo}
          style={styles.circle}
          contentFit="cover"
          // Decorative: the label under the circle already names the cuisine,
          // and the pressable carries the full accessibility label.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        <PhotoView uri={photoUri} style={styles.circle} decorative placeholderIconSize={28} />
      )}
      {/* Название кухни приходит из каталога и показывается ЦЕЛИКОМ.
          Раньше здесь стояло numberOfLines={1} и «Средиземноморская»
          превращалась в обрезок (правка владельца 2026-08-24). Две строки
          спасают составные названия, а одно длинное слово переносить не по
          чему — поэтому шрифт ужимается до 0.75 (12 → 9) в пределах
          ширины ячейки. Обрезка — последнее, чего мы хотим: сокращённое
          название кухни гость не узнаёт. */}
      <Text
        style={styles.label}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {cuisine.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    // Ячейка шире круга — подпись под ним длиннее круга (см. cuisineChipLabel).
    width: exploreLayout.cuisineChipLabel,
    alignItems: "center",
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  circle: {
    width: exploreLayout.cuisineChip,
    height: exploreLayout.cuisineChip,
    borderRadius: radius.pill,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  label: {
    ...typography.caption,
    color: colors.text.primary,
    textAlign: "center",
    width: "100%",
    // Две строки резервируются всегда, чтобы круги соседних кухонь стояли на
    // одной высоте независимо от длины названия.
    minHeight: typography.caption.lineHeight * 2,
  },
});
