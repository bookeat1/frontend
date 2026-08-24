import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { X } from "./icons";

interface FilterChipBaseProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /**
   * Colour of the SELECTED state. `dark` is the search-results filter row
   * (solid black pill) — the default, so every existing call site is
   * unchanged. `brand` is the brand-red pill the Filters bottom-sheet uses for
   * its occasion / cuisine chips (read off the sheet reference PNG). Same
   * component, one number — not a second chip.
   */
  selectedTone?: "dark" | "brand";
  /**
   * `roomy` — 16 отступа по бокам вместо 12 (чипы «Все / Рестораны / События /
   * Акции» на экране «Избранные», макет 602:3630). Одно число, как и
   * `selectedTone`, — не второй компонент-чип.
   *
   * Высота при этом остаётся 44, хотя в макете чип 40: минимальная цель
   * касания в этом репозитории — жёсткое правило доступности, и это уже
   * ловилось на ревью (чипы были 36).
   */
  size?: "default" | "roomy";
}

/**
 * Крестик «снять этот фильтр» внутри чипа. Пара, а не два независимых пропа:
 * крестик без метки — немая кнопка, а метка без обработчика — обещание
 * действия, которого нет. Метка обязана называть фильтр («Убрать фильтр
 * Греческая»), иначе подряд идущие чипы озвучиваются одинаково.
 */
type FilterChipRemoveProps =
  | { onRemove: () => void; removeAccessibilityLabel: string }
  | { onRemove?: undefined; removeAccessibilityLabel?: undefined };

type FilterChipProps = FilterChipBaseProps & FilterChipRemoveProps;

/**
 * Matches the search-screen filter chip: unselected chips sit on the light
 * `chipAlt` fill, the selected chip inverts to a solid pill with white text.
 * On the search-results row that pill is black (Figma nodes 347:5773–347:5778);
 * inside the Filters sheet it is brand-red (`selectedTone="brand"`).
 */
export function FilterChip({
  label,
  selected = false,
  onPress,
  selectedTone = "dark",
  size = "default",
  onRemove,
  removeAccessibilityLabel,
}: FilterChipProps) {
  const removable = onRemove !== undefined;
  return (
    <Pressable
      // У чипа с крестиком доступны ДВЕ вещи по отдельности: сам текст фильтра
      // и кнопка «убрать». Если оставить контейнер accessible, скринридер
      // склеит их в одну немую цель и до крестика не доберётся. Тап по всему
      // чипу при этом продолжает снимать фильтр — это то же действие.
      accessible={!removable}
      accessibilityRole={removable ? undefined : "button"}
      accessibilityState={removable ? undefined : { selected }}
      accessibilityLabel={removable ? undefined : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        size === "roomy" && styles.chipRoomy,
        selected && (selectedTone === "brand" ? styles.chipSelectedBrand : styles.chipSelected),
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {removable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={removeAccessibilityLabel}
          hitSlop={spacing.sm}
          onPress={onRemove}
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
        >
          <X
            size={spacing.lg}
            color={selected ? colors.text.onDark : colors.text.mutedStrong}
            weight="bold"
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: hitSlop.minTouchTarget,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chipAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRoomy: {
    paddingHorizontal: spacing.lg,
  },
  chipSelected: {
    backgroundColor: colors.background.chipActive,
  },
  chipSelectedBrand: {
    backgroundColor: colors.brand.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  remove: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  labelSelected: {
    color: colors.text.onDark,
  },
});
