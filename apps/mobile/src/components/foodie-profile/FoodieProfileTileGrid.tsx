import type { FoodieOption } from "@bookeat/api";
import { foodieProfileLayout, spacing } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { SelectableTile } from "./SelectableTile";

/**
 * Сетка в 3 колонки для экранов «Кухня»/«Диета»/«Аллергии». Ширина колонки
 * считается от окна — тот же приём, что `rubricColumnWidth` в
 * `GuideRubricGrid`, только для трёх колонок вместо двух и с полями листа
 * `spacing.lg` (16), как у остальных экранов онбординга.
 *
 * `options` — живой справочник (`useFoodieOptions()`, `GET
 * /foodie-profile/options`), уже отсортированный сервером/репозиторием;
 * `option.name`/`option.imageUrl` рисуются как есть — сервер сам разрешил
 * локаль, клиенту выбирать её незачем. Идентичность плитки и значение выбора
 * — `option.code` (то же, что летает в `FoodieProfile.cuisines/diets/
 * allergies`), не `option.id` (id справочника, серверный UUID).
 */
export function FoodieProfileTileGrid({
  options,
  selected,
  disabledIds,
  photoFor,
  onToggle,
  accessibilityHintFor,
}: {
  options: readonly FoodieOption[];
  selected: readonly string[];
  /** Плитки, недостижимые прямо сейчас (лимит кухонь набран). Пусто на
   * экранах без лимита. */
  disabledIds?: ReadonlySet<string>;
  /** Вшитый запасной снимок по коду — сегодня только у экрана «Кухня»
   * (`cuisineOptionPhoto`), пока у справочника нет своих картинок. */
  photoFor?: (code: string) => number | undefined;
  onToggle: (code: string) => void;
  accessibilityHintFor?: (code: string, disabled: boolean) => string | undefined;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const tileWidth = foodieProfileTileWidth(windowWidth);

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const isSelected = selected.includes(option.code);
        const isDisabled = !isSelected && (disabledIds?.has(option.code) ?? false);
        return (
          <SelectableTile
            key={option.id || option.code}
            label={option.name}
            imageUrl={option.imageUrl}
            photo={photoFor?.(option.code)}
            selected={isSelected}
            disabled={isDisabled}
            width={tileWidth}
            onPress={() => onToggle(option.code)}
            accessibilityHint={accessibilityHintFor?.(option.code, isDisabled)}
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
