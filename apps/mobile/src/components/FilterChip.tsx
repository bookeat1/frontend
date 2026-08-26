import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
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
   * Акции» на экране «Избранное», макет 602:3630). Одно число, как и
   * `selectedTone`, — не второй компонент-чип.
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
 * Чип-фильтр. Размеры сняты с узла 347:5942 (экран «Поиск», ряд под строкой
 * поиска): высота 40, скругление 999, боковой отступ 12, подложка `chipAlt`
 * (#F3F2F2), подпись Noto Sans Medium 14/20 цветом `text.primary` (#1B1B1B),
 * зазор между подписью и иконкой 8.
 *
 * Высота 40 при жёстком правиле «цель касания ≥ 44» — не послабление:
 * недостающие 4 добираются вертикальным hitSlop'ом, и палец попадает в 48.
 * Уменьшать зону касания было бы регрессом, а рисовать 44 там, где в макете
 * 40, — рассинхроном с дизайном; hitSlop закрывает оба требования разом.
 *
 * `selected` инвертирует чип в сплошную пилюлю с белым текстом — этим живёт
 * шторка «Фильтры» (`selectedTone="brand"`, бордовая) и ряды-переключатели.
 * Ряд ПРИМЕНЁННЫХ фильтров над выдачей выбранным тоном не пользуется: там все
 * чипы по определению активны, и по узлу 347:5942 они серые с тёмной
 * подписью — сплошная заливка отличала бы их не от чего.
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
      // Чип рисуется на 40, а нажимается на 48 — см. комментарий к компоненту.
      hitSlop={CHIP_TOUCH_SLOP}
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

/**
 * Сколько не хватает нарисованным 40 до минимальной цели касания. По вертикали
 * — по 4 сверху и снизу; по горизонтали чипы стоят в 8 друг от друга, и
 * растягивать их зоны навстречу нельзя: соседние перекрылись бы.
 */
const CHIP_TOUCH_SLOP = {
  top: (hitSlop.minTouchTarget - controlHeight.chip) / 2,
  bottom: (hitSlop.minTouchTarget - controlHeight.chip) / 2,
  left: 0,
  right: 0,
} as const;

const styles = StyleSheet.create({
  chip: {
    minHeight: controlHeight.chip,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
