import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Переключатель «Активные / История» на экране броней — ряд чипов-капсул,
 * а НЕ сегментированная дорожка (Figma 3z0f6dgev4HMwBAHPjTjPo, узлы
 * 1033:15569 → 1033:15570/1033:15572).
 *
 * По макету: чипы прижаты влево и занимают ровно ширину подписи (ряд 183
 * при экране 375), высота 40, боковой отступ 12, скругление-капсула, зазор 6.
 * Выбранный — сплошной фирменный #B33036 с белой подписью, невыбранный —
 * светло-серый #F3F2F2 с тёмной. Раньше это была серая дорожка с белой
 * пилюлей внутри и вкладками во всю ширину — в макете такого элемента нет.
 *
 * Это НЕ `SegmentedTabs`: тот рисует подчёркнутый ряд вкладок на карточке
 * заведения и в галерее фотографий. И это НЕ `FilterChip`: тот — фильтр с
 * крестиком/шевроном и своей семантикой (`button` + `selected`), а здесь
 * вкладки, которым нужна роль `tab`/`tablist`, иначе скринридер прочитает
 * переключение раздела как включение фильтра.
 *
 * Подпись у выбранной и невыбранной вкладки одного кегля и начертания
 * (14/20 Medium) — различает их заливка, как и в макете.
 */

/** Зазор между чипами — 6 (ряд 1033:15569: 93 + 6 = 99). В 4pt-шкале
 * `spacing` такого шага нет, поэтому число живёт здесь. */
const TAB_GAP = 6;

export function PillTabs({
  labels,
  activeIndex,
  onChange,
}: {
  labels: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {labels.map((label, index) => {
        const active = index === activeIndex;
        return (
          <Pressable
            key={label}
            onPress={() => onChange(index)}
            accessibilityRole="tab"
            // `aria-selected`, а не `accessibilityState`: React Native
            // отображает aria-* в нативное состояние сам, а react-native-web
            // (на нём крутятся тесты) accessibilityState в DOM не выносит —
            // так активная вкладка видна и голосовому доступу, и тесту.
            aria-selected={active}
            accessibilityLabel={label}
            // Чип рисуется на 40, а нажимается на 44: по 2 сверху и снизу.
            // По горизонтали не растягиваем — соседний чип в 6 точках,
            // зоны касания перекрылись бы.
            hitSlop={TAB_TOUCH_SLOP}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TAB_TOUCH_SLOP = {
  top: (hitSlop.minTouchTarget - controlHeight.chip) / 2,
  bottom: (hitSlop.minTouchTarget - controlHeight.chip) / 2,
  left: 0,
  right: 0,
} as const;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: TAB_GAP,
  },
  tab: {
    // Чипы прижаты влево и по ширине подписи — без `flex: 1`, иначе они
    // растянутся во всю строку, чего в макете нет.
    alignSelf: "flex-start",
    height: controlHeight.chip,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chipAlt,
  },
  tabActive: {
    backgroundColor: colors.brand.primary,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  labelActive: {
    ...typography.labelMedium,
    color: colors.text.onBrand,
  },
});
