import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Stack, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BudgetOptionCard } from "../../src/components/foodie-profile/BudgetOptionCard";
import { FoodieProfileHeader } from "../../src/components/foodie-profile/FoodieProfileHeader";
import { BUDGET_TIERS } from "../../src/components/foodie-profile/foodie-profile-options";
import { useFoodieProfileDraft } from "../../src/lib/foodie-profile-draft";
import type { BudgetTier } from "../../src/lib/foodie-profile-selection";

const t = getDictionary();

/**
 * Шаг 4/4 — «Ваш бюджет» (Figma node 5161:11786). Единственный
 * НЕОБЯЗАТЕЛЬНЫЙ шаг визарда: «Далее» (здесь — «Готово») доступна и без
 * выбора.
 *
 * ДЕФОЛТ — ничего не выбрано (`draft.budget === null` из
 * `FoodieProfileDraftProvider`). В макете карточка «Средний» нарисована
 * выбранной, но это демонстрация состояния, а не предустановленный ответ
 * гостя — решение и его причина подробно объяснены в
 * `foodie-profile-selection.ts`.
 *
 * ФИНАЛ. Сохранения на бэкенд нет — эндпоинта под фуди-профиль ещё не
 * существует (отдельная будущая задача). Собранный черновик печатается в
 * консоль (`console.info`, только это и остаётся от «отправки» на этом этапе)
 * и визард уходит на `/profile`, откуда его временно и открывают
 * (см. ProfileMenuRow «Фуди-профиль» в profile.tsx).
 */
export default function FoodieProfileBudgetScreen() {
  const router = useRouter();
  const { draft, setBudget } = useFoodieProfileDraft();

  const finish = useCallback(() => {
    // Временная точка «сохранения», пока эндпоинта фуди-профиля на бэкенде
    // нет; заменится реальным вызовом API вместе с задачей на бэкенд.
    console.info("[foodie-profile] draft", draft);
    router.replace("/profile");
  }, [draft, router]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FoodieProfileHeader
          step={4}
          onBack={() => router.back()}
          nextLabel={t.onboarding.foodieProfile.done}
          nextEnabled
          onNext={finish}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.onboarding.foodieProfile.budget.title}
        </Text>
        <Text style={styles.subtitle}>{t.onboarding.foodieProfile.budget.subtitle}</Text>

        <View style={styles.list}>
          {BUDGET_TIERS.map((tier: BudgetTier) => {
            const copy = t.onboarding.foodieProfile.budget.options[tier];
            return (
              <BudgetOptionCard
                key={tier}
                name={copy.name}
                description={copy.description}
                price={copy.price}
                selected={draft.budget === tier}
                onPress={() => setBudget(tier)}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heading: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  list: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
