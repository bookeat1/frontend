import { colors, controlHeight, hitSlop, radius, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FadersHorizontal } from "../icons";

const t = getDictionary();

interface FilterButtonProps {
  /** Сколько поддерживаемых фильтров активно — 0 прячет бейдж. */
  count: number;
  onPress: () => void;
}

/**
 * Кнопка с иконкой ползунков, открывающая шторку «Фильтры». Когда есть
 * активные фильтры — в правом верхнем углу красный бейдж со счётчиком
 * (читается вместе с кнопкой, а не остаётся немым кружком). Не `IconButton`:
 * тот без бейджа и другого размера.
 *
 * 40x40 со значком 20 — узел 347:5942 («Frame 43»: отступ 10 со всех сторон
 * вокруг значка 20, скругление 999, подложка #F3F2F2). Ровно та же высота, что
 * у чипов справа: раньше кнопка была 44 и торчала над рядом на 4. До
 * минимальной цели касания добирает hitSlop — как у самих чипов.
 */
export function FilterButton({ count, onPress }: FilterButtonProps) {
  const active = count > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? t.a11y.openFiltersWithCount(count) : t.a11y.openFilters}
      onPress={onPress}
      hitSlop={(hitSlop.minTouchTarget - controlHeight.chip) / 2}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <FadersHorizontal size={20} color={colors.text.primary} weight="regular" />
      {active ? (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <Text style={styles.badgeLabel}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: controlHeight.chip,
    height: controlHeight.chip,
    // Полное скругление: в макете это круг, а не квадрат со скруглёнными
    // углами — рядом с чипом-пилюлей квадрат читался как другой элемент.
    borderRadius: radius.pill,
    backgroundColor: colors.background.chipAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    // Отделяем бейдж от кнопки тонкой белой каймой, чтобы он читался поверх.
    borderWidth: 2,
    borderColor: colors.background.surface,
  },
  badgeLabel: {
    ...typography.captionMedium,
    color: colors.text.onBrand,
  },
});
