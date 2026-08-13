import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useCallback, useEffect, useRef } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Колесо выбора — «Гости» и «Дата» в макетах 918:12428 и 918:12317.
 *
 * Значения идут столбиком, выбранное стоит по центру в светлой плашке,
 * соседние приглушены. Прокрутка липнет к строке (snapToInterval), поэтому
 * колесо не может остановиться между значениями и показать выбор, которого нет.
 *
 * Строки ещё и нажимаются. Это не украшение: попасть пальцем в нужное значение
 * прокруткой на длинном списке дат тяжело, а тап по видимой строке — самый
 * короткий путь. Скроллом и тапом управляет один и тот же обработчик, так что
 * два способа не могут разойтись в том, что считается выбранным.
 */

export const WHEEL_ROW_HEIGHT = 48;
/** Сколько соседних строк видно сверху и снизу от выбранной. */
const VISIBLE_NEIGHBOURS = 1;

export interface WheelOption {
  /** Значение, которое вернётся наверх. */
  value: string;
  label: string;
}

export function WheelPicker({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
}) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  // Держим колесо на выбранном значении: при открытии шторки и когда выбор
  // меняют снаружи (например, сменили дату и число гостей стало недоступным).
  useEffect(() => {
    ref.current?.scrollTo({ y: index * WHEEL_ROW_HEIGHT, animated: false });
  }, [index]);

  const settle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ROW_HEIGHT);
      const picked = options[Math.min(Math.max(next, 0), options.length - 1)];
      if (picked && picked.value !== value) onChange(picked.value);
    },
    [onChange, options, value],
  );

  const height = WHEEL_ROW_HEIGHT * (VISIBLE_NEIGHBOURS * 2 + 1);

  return (
    <View style={[styles.root, { height }]} accessibilityLabel={accessibilityLabel}>
      {/* Плашка выбранного значения лежит ПОД списком и не двигается: она
          обозначает центр колеса, а не конкретную строку. */}
      <View
        style={[styles.highlight, { top: WHEEL_ROW_HEIGHT * VISIBLE_NEIGHBOURS }]}
        pointerEvents="none"
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ROW_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        // Медленное «дотягивание» пальцем не даёт momentum-события, и без этого
        // колесо молча оставалось бы на старом значении.
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: WHEEL_ROW_HEIGHT * VISIBLE_NEIGHBOURS }}
      >
        {options.map((option, i) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: i === index }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={styles.row}
          >
            <Text style={[styles.label, i === index && styles.labelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: "center",
  },
  highlight: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WHEEL_ROW_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  row: {
    height: WHEEL_ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  label: {
    ...typography.body,
    color: colors.text.muted,
  },
  labelSelected: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
});
