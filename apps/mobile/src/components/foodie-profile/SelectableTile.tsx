import { colors, foodieProfileLayout, radius, typography } from "@bookeat/design-tokens";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "../icons";
import { PhotoView } from "../PhotoView";

/**
 * Квадратная плитка «кухня / диета / аллергия»: фото на фон, затемнение
 * снизу, название в левом нижнем углу — экраны 1–3 визарда «Фуди-профиль»
 * (Figma qmMsg4jO1ggmyEHNIAD2ll, узлы 5161:11573 / 5062:5734 / 5062:5841).
 * Раскладка — та же связка «фото + градиент + подпись поверх», что уже несёт
 * `GuideRubricTile` (гастрогид), только в сетке из трёх колонок вместо двух и
 * с состоянием «выбрано».
 *
 * ФОТО. `photo` — локальный `require()`-ресурс (число), когда для пункта
 * есть вшитый снимок (см. `cuisineOptionPhoto` в `foodie-profile-options.ts`
 * — переиспользует маппинг, уже заведённый для ряда «Выберите кухню» на
 * главной). Без него плитка рисует ту же плашку «фото нет», что и блюдо без
 * картинки (`PhotoView` с `uri={null}`) — существующий паттерн заглушки, а не
 * новый. Настоящих фотографий под эти категории нет и не будет в этой задаче
 * (только вёрстка, бэкенда для фуди-профиля не существует).
 *
 * ВЫБРАННОЕ СОСТОЯНИЕ — обводка бренда поверх плитки и галочка в кружке в
 * правом верхнем углу. Координатор передал раскладку и цвета шапки/пагинации/
 * карточек бюджета из макета, но не описывал вид ВЫБРАННОЙ плитки сетки —
 * это решение агента по аналогии с обводкой бренда у карточки бюджета
 * (четвёртый экран) и стандартной галочкой выбора остальных чек-листов
 * приложения, а не снятое с узла значение.
 */
export function SelectableTile({
  label,
  photo,
  selected,
  disabled,
  onPress,
  width,
  accessibilityHint,
}: {
  label: string;
  photo?: number;
  selected: boolean;
  /** Плитка недостижима — лимит кухонь набран, а эта не выбрана. Остаётся
   * видимой (не исчезает), но притушена и не ловит тап: см.
   * `foodie-profile-selection.ts` про решение «блокировать, а не вытеснять». */
  disabled?: boolean;
  onPress: () => void;
  width: number;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      // `aria-checked`/`aria-disabled`, а не `accessibilityState`: React
      // Native сам сводит aria-* в нативное accessibility state, а
      // react-native-web (на нём крутятся тесты) accessibilityState в DOM не
      // выносит — см. тот же приём в PillTabs.tsx.
      aria-checked={selected}
      aria-disabled={Boolean(disabled)}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { width, height: width },
        selected && styles.tileSelected,
        disabled && styles.tileDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {photo ? (
        <Image testID="tile-photo" source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <PhotoView uri={null} style={StyleSheet.absoluteFill} decorative placeholderIconSize={24} />
      )}
      <LinearGradient
        colors={[colors.guide.scrimStart, colors.guide.rubricScrimEnd]}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Text style={styles.label} numberOfLines={2} ellipsizeMode="tail">
        {label}
      </Text>
      {selected ? (
        <View style={styles.checkBadge}>
          <Check size={14} color={colors.text.onBrand} weight="bold" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.media,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: foodieProfileLayout.tilePadding,
    backgroundColor: colors.background.chip,
  },
  tileSelected: {
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  tileDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.onDark,
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.primary,
  },
});
