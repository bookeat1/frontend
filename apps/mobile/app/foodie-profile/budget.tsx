import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Stack, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
 * ФИНАЛ. «Готово» шлёт весь черновик одним `PUT /users/me/foodie-profile`
 * (`FoodieProfileDraftProvider.save`) и уходит на `/profile` только при
 * успехе — при отказе черновик остаётся на экране вместе с текстом ошибки,
 * «Готово» можно нажать ещё раз.
 *
 * ЗАЩИТА ОТ ТИХОЙ ПОТЕРИ ДАННЫХ. `PUT` заменяет весь профиль целиком, а не
 * мержит. Пока стартовый `GET` (см. `foodie-profile-draft.tsx`) ещё грузится
 * или упал — «Готово» заблокирована: иначе на плохой сети гость может
 * протапать шаги поверх непрогруженного черновика и стереть ранее
 * сохранённые категории пустым/неполным `PUT`.
 */
export default function FoodieProfileBudgetScreen() {
  const router = useRouter();
  const {
    draft,
    setBudget,
    isSaving,
    saveFailed,
    isLoadingProfile,
    profileLoadFailed,
    retryLoadProfile,
    save,
  } = useFoodieProfileDraft();

  const finish = useCallback(() => {
    void (async () => {
      const ok = await save();
      if (ok) router.replace("/profile");
    })();
  }, [save, router]);

  const goBack = useCallback(() => {
    if (isSaving) return;
    router.back();
  }, [isSaving, router]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FoodieProfileHeader
          step={4}
          onBack={goBack}
          nextLabel={isSaving || isLoadingProfile ? t.common.loading : t.onboarding.foodieProfile.done}
          nextEnabled={!isSaving && !isLoadingProfile && !profileLoadFailed}
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

        {profileLoadFailed ? (
          <View style={styles.loadErrorBox}>
            <Text style={styles.saveError} accessibilityRole="alert">
              {t.onboarding.foodieProfile.loadFailed}
            </Text>
            <Pressable accessibilityRole="button" onPress={retryLoadProfile}>
              <Text style={styles.retryLabel}>{t.common.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {saveFailed ? (
          <Text style={styles.saveError} accessibilityRole="alert">
            {t.onboarding.foodieProfile.saveFailed}
          </Text>
        ) : null}
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
  saveError: {
    ...typography.body,
    color: colors.brand.primary,
    marginTop: spacing.md,
  },
  loadErrorBox: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  retryLabel: {
    ...typography.labelSemiBold,
    color: colors.brand.primary,
  },
});
