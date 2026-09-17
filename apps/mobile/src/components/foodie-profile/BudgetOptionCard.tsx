import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Карточка тарифа бюджета — экран 4 визарда «Фуди-профиль» (Figma
 * qmMsg4jO1ggmyEHNIAD2ll, node 5161:11786). Список, не сетка: название и
 * описание слева, цена справа, radius 16, поле 12.
 *
 * Невыбранная — `background.chip`-подобная светло-серая заливка без обводки
 * (`colors.onboarding.budgetCardSurface`, #FAFAFA); выбранная — почти белая
 * (`budgetCardSelectedSurface`, #FFFBFB) с обводкой бренда 1.5, как в макете.
 *
 * `description`/`price` необязательны: «осиротевшая» карточка — ярус, который
 * гость выбрал раньше, а админ потом скрыл (`withHiddenSelected`), — несёт
 * только код без перевода (нет активной записи справочника, чтобы взять
 * из неё копию), а не полный набор полей.
 */
export function BudgetOptionCard({
  name,
  description,
  price,
  selected,
  onPress,
}: {
  name: string;
  description?: string;
  price?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={price ? `${name}, ${price}` : name}
      accessibilityHint={description || undefined}
      // `aria-checked`, а не `accessibilityState` — см. SelectableTile.tsx.
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text style={styles.name}>{name}</Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {price ? <Text style={styles.price}>{price}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.media,
    padding: spacing.md,
    backgroundColor: colors.onboarding.budgetCardSurface,
  },
  cardSelected: {
    backgroundColor: colors.onboarding.budgetCardSelectedSurface,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  description: {
    ...typography.caption,
    color: colors.text.navInactive,
  },
  price: {
    ...typography.labelSemiBold,
    color: colors.text.brand,
  },
});
