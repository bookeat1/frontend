import { foodieProfileLayout, spacing } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { SelectableTile } from "./SelectableTile";
import type { FoodieProfileOption } from "./foodie-profile-options";

/**
 * Сетка в 3 колонки для экранов «Кухня»/«Диета»/«Аллергии». Ширина колонки
 * считается от окна — тот же приём, что `rubricColumnWidth` в
 * `GuideRubricGrid`, только для трёх колонок вместо двух и с полями листа
 * `spacing.lg` (16), как у остальных экранов онбординга.
 */
export function FoodieProfileTileGrid({
  options,
  selected,
  disabledIds,
  labelFor,
  photoFor,
  onToggle,
  accessibilityHintFor,
}: {
  options: readonly FoodieProfileOption[];
  selected: readonly string[];
  /** Плитки, недостижимые прямо сейчас (лимит кухонь набран). Пусто на
   * экранах без лимита. */
  disabledIds?: ReadonlySet<string>;
  labelFor: (id: string) => string;
  photoFor?: (id: string) => number | undefined;
  onToggle: (id: string) => void;
  accessibilityHintFor?: (id: string, disabled: boolean) => string | undefined;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const tileWidth = foodieProfileTileWidth(windowWidth);

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        const isDisabled = !isSelected && (disabledIds?.has(option.id) ?? false);
        return (
          <SelectableTile
            key={option.id}
            label={labelFor(option.id)}
            photo={photoFor?.(option.id)}
            selected={isSelected}
            disabled={isDisabled}
            width={tileWidth}
            onPress={() => onToggle(option.id)}
            accessibilityHint={accessibilityHintFor?.(option.id, isDisabled)}
          />
        );
      })}
    </View>
  );
}

/**
 * Ширина одной плитки на экране шириной `screenWidth`: лист с полями
 * `spacing.lg` по бокам, три колонки, просвет `foodieProfileLayout.tileGap`
 * между ними. Вынесена и покрыта тестом отдельно от компонента — как
 * `rubricColumnWidth`, единственное место, где геометрия превращается в число.
 */
export function foodieProfileTileWidth(screenWidth: number): number {
  const content = screenWidth - spacing.lg * 2;
  const gaps = foodieProfileLayout.tileGap * (foodieProfileLayout.tileColumns - 1);
  return Math.floor((content - gaps) / foodieProfileLayout.tileColumns);
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: foodieProfileLayout.tileGap,
    rowGap: foodieProfileLayout.tileGap,
  },
});
