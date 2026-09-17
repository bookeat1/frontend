import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Stack, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BudgetOptionCard } from "../../src/components/foodie-profile/BudgetOptionCard";
import { FoodieProfileHeader } from "../../src/components/foodie-profile/FoodieProfileHeader";
import { DataErrorState } from "../../src/components/DataErrorState";
import { LoadingState } from "../../src/components/StateViews";
import { useFoodieOptions } from "../../src/hooks/useFoodieOptions";
import { useFoodieProfileDraft } from "../../src/lib/foodie-profile-draft";

const t = getDictionary();

/**
 * Шаг 4/4 — «Ваш бюджет» (Figma node 5161:11786). Единственный
 * НЕОБЯЗАТЕЛЬНЫЙ шаг визарда: «Далее» (здесь — «Готово») доступна и без
 * выбора (при условии, что справочник загрузился — см. ниже).
 *
 * ВАРИАНТЫ — живой справочник (`useFoodieOptions().data.budgets`), а не
 * вшитая тройка «budget/mid/premium»: суперадмин теперь может добавить
 * новый ярус (спека 3.10, пример `ultra`) без релиза сборки. `draft.budget`
 * хранит `code` выбранного яруса как обычную строку (`BudgetTier = string`,
 * см. `foodie-profile-selection.ts`) — тип-литерал из трёх значений снят
 * этой же задачей, иначе клиент отверг бы тариф, который сервер уже принял.
 *
 * ДЕФОЛТ — ничего не выбрано (`draft.budget === null` из
 * `FoodieProfileDraftProvider`). В макете карточка «Средний» нарисована
 * выбранной, но это демонстрация состояния, а не предустановленный ответ
 * гостя — решение и его причина подробно объяснены в
 * `foodie-profile-selection.ts`.
 *
 * СКРЫТЫЙ ЯРУС НЕ РИСУЕТСЯ (спека §3.5, критерий 20/22). Если сохранённый
 * `budget` гостя больше не входит в активный список, `FoodieProfileDraftProvider`
 * гидрирует `draft.budget = null` — экран здесь не занимается спецслучаями.
 *
 * ФИНАЛ. «Готово» шлёт весь черновик одним `PUT /users/me/foodie-profile`
 * (`FoodieProfileDraftProvider.save`) и уходит на `/profile` только при
 * успехе — при отказе черновик остаётся на экране вместе с текстом ошибки,
 * «Готово» можно нажать ещё раз.
 *
 * ЗАЩИТА ОТ ТИХОЙ ПОТЕРИ ДАННЫХ. `PUT` заменяет весь профиль целиком, а не
 * мержит. Пока стартовый `GET` (см. `foodie-profile-draft.tsx`) ещё грузится
 * или упал, ИЛИ пока справочник бюджетных ярусов ещё грузится/упал — «Готово»
 * заблокирована: иначе на плохой сети гость может протапать шаги поверх
 * непрогруженного черновика и стереть ранее сохранённые категории
 * пустым/неполным `PUT`.
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
  const optionsQuery = useFoodieOptions();
  const tiers = optionsQuery.data?.budgets ?? [];

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

  const optionsReady = optionsQuery.isSuccess;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FoodieProfileHeader
          step={4}
          onBack={goBack}
          nextLabel={isSaving || isLoadingProfile ? t.common.loading : t.onboarding.foodieProfile.done}
          nextEnabled={optionsReady && !isSaving && !isLoadingProfile && !profileLoadFailed}
          onNext={finish}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.onboarding.foodieProfile.budget.title}
        </Text>
        <Text style={styles.subtitle}>{t.onboarding.foodieProfile.budget.subtitle}</Text>

        {optionsQuery.isLoading ? (
          <LoadingState title={t.onboarding.foodieProfile.optionsLoading} compact />
        ) : optionsQuery.isError ? (
          <DataErrorState error={optionsQuery.error} onRetry={() => void optionsQuery.refetch()} compact />
        ) : (
          <View style={styles.list}>
            {tiers.map((tier) => (
              <BudgetOptionCard
                key={tier.id || tier.code}
                name={tier.name}
                description={tier.description}
                price={tier.priceLabel}
                selected={draft.budget === tier.code}
                onPress={() => setBudget(tier.code)}
              />
            ))}
          </View>
        )}

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
