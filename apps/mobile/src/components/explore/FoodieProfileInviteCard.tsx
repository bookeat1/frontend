import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFoodieProfileInvite } from "../../hooks/useFoodieProfileInvite";
import { Sparkle, X } from "../icons";

const t = getDictionary();

/**
 * «Расскажите, что любите» — карточка-приглашение в визард «Фуди-профиль»
 * (персонализация v1, `specs/foodie-personalization-v1-20260916.md`,
 * сценарий 3.2/8.2, раздел 5.7, критерий 22). Место на экране — МЕЖДУ
 * `RecommendedSection` и `CuisineSection`, ровно как в диаграмме 5.7.
 *
 * САМОДОСТАТОЧНА: данные (видимость, счётчик закрытий, 30-дневный снуз) —
 * целиком в `useFoodieProfileInvite`, компонент сам решает, рисовать ли себя
 * вовсе (`null`, когда невидима), а не полагается на условие снаружи — тот
 * же приём, что у `EventsListSection` («блока нет вовсе, когда нечего
 * показать»). Единственное, что приходит СНАРУЖИ, — `onPress`: навигация
 * везде в этом экране идёт колбэком от `app/index.tsx`, не своим
 * `useRouter()` внутри секции (см. `RecommendedSection`/`CuisineSection`).
 *
 * НЕТ Figma-узла: элемент новый, введённый этой задачей поверх бэкенда, а
 * не найденный в существующем макете главной — цвета и геометрия взяты из
 * уже утверждённых токенов (`SectionCard`/чип карточки «Для вас»), а не
 * подобраны на глаз.
 */
export function FoodieProfileInviteCard({ onPress }: { onPress: () => void }) {
  const { visible, dismiss } = useFoodieProfileInvite();
  if (!visible) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.foodieInviteTitle}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconBadge}>
        <Sparkle size={20} color={colors.brand.primary} weight="fill" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {t.explore.foodieInviteTitle}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {t.explore.foodieInviteSubtitle}
        </Text>
      </View>
      {/* Крестик — свой Pressable ВНУТРИ карточки-Pressable: касание по нему
          не всплывает наверх (тот же приём, что у FavoriteButton поверх
          RecommendedRestaurantCard), поэтому закрытие не открывает визард. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.explore.foodieInviteDismiss}
        onPress={dismiss}
        hitSlop={10}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <X size={18} color={colors.text.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.background.surface,
    borderRadius: radius.homeSection,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.8,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.itemName,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
  close: {
    width: hitSlop.minTouchTarget - 20,
    height: hitSlop.minTouchTarget - 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
