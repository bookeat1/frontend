import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Сегментированный переключатель: серая дорожка со скруглением-капсулой, а
 * активная вкладка — белая «пилюля» внутри неё (Figma
 * dVjT37j984ErvOmzxlx29p, node 3004:6801).
 *
 * Это НЕ `SegmentedTabs`: тот рисует подчёркнутый ряд вкладок и стоит на
 * карточке заведения и в галерее фотографий. Два разных элемента управления
 * из макета живут отдельно намеренно — попытка сделать один с пропом-видом
 * означала бы, что правка на экране броней двигает пиксели на карточке
 * заведения.
 *
 * Вкладки делят ширину поровну (`flex: 1`), поэтому длинные русские подписи
 * («Предстоящие») получают ровно половину дорожки и обрезаются многоточием,
 * а не выдавливают соседа за край на 360 px.
 *
 * Белая пилюля не едет, а перекрашивается: анимация её положения требует
 * измерения дорожки через `onLayout`, а до первого измерения переключатель
 * оставался бы без выделенной вкладки. Пропущенный кадр анимации дешевле
 * кадра, на котором не видно, где ты находишься.
 */

/** Высота вкладки: 10 + 20 (строка) + 10 = 40, как в макете (node 3004:6802).
 * Вне 4pt-шкалы, поэтому число локальное, а не токен. */
const TAB_PADDING_VERTICAL = 10;

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
    <View style={styles.track} accessibilityRole="tablist">
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
            // Вкладка 40 высотой внутри дорожки в 44: два пикселя отступа
            // сверху и снизу добирают минимальную цель касания.
            hitSlop={{ top: spacing.xxs, bottom: spacing.xxs }}
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

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: spacing.xxs,
    padding: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.background.screen,
    minHeight: hitSlop.minTouchTarget,
  },
  tab: {
    flex: 1,
    // `minWidth: 0` в RN не нужен — flexBasis 0 уже позволяет вкладке сжаться;
    // важно только, чтобы подпись обрезалась, а не растягивала дорожку.
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: TAB_PADDING_VERTICAL,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.background.surface,
  },
  label: {
    ...typography.body,
    color: colors.text.primary,
  },
  // В макете подпись активной и неактивной вкладки одного цвета и кегля —
  // различает их именно белая пилюля. Начертание всё же меняем: на сером
  // фоне одна лишь заливка плохо читается при ярком солнце, а полужирный
  // тот же размер и не двигает соседей.
  labelActive: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
});
