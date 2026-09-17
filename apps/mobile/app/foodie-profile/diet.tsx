import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Stack, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DataErrorState } from "../../src/components/DataErrorState";
import { FoodieProfileHeader } from "../../src/components/foodie-profile/FoodieProfileHeader";
import { FoodieProfileTileGrid } from "../../src/components/foodie-profile/FoodieProfileTileGrid";
import { LoadingState } from "../../src/components/StateViews";
import { useFoodieOptions } from "../../src/hooks/useFoodieOptions";
import { useFoodieProfileDraft } from "../../src/lib/foodie-profile-draft";
import { withHiddenSelected } from "../../src/lib/foodie-profile-visible-options";

const t = getDictionary();

/**
 * Шаг 2/4 — «Диетические предпочтения» (Figma node 5062:5734).
 *
 * ВАРИАНТЫ — живой справочник (`useFoodieOptions()`), см. `cuisine.tsx` для
 * полного обоснования состояний загрузки/ошибки и `withHiddenSelected` —
 * то же решение применяется здесь один в один.
 *
 * «Без диеты» ЭКСКЛЮЗИВЕН относительно остальных девяти (решение агента,
 * обоснование — в `foodie-profile-selection.ts`): выбор снимает всё прочее и
 * наоборот. Лимита на число выбранных пунктов здесь нет, в отличие от кухонь.
 */
export default function FoodieProfileDietScreen() {
  const router = useRouter();
  const { draft, toggleDiet } = useFoodieProfileDraft();
  const optionsQuery = useFoodieOptions();
  const selected = draft.diets;

  const options = useMemo(
    () => withHiddenSelected(optionsQuery.data?.diets ?? [], selected),
    [optionsQuery.data, selected],
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FoodieProfileHeader
          step={2}
          onBack={() => router.back()}
          nextLabel={t.onboarding.foodieProfile.next}
          nextEnabled={optionsQuery.isSuccess && selected.length > 0}
          onNext={() => router.push("/foodie-profile/allergies")}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.onboarding.foodieProfile.diet.title}
        </Text>
        <Text style={styles.subtitle}>{t.onboarding.foodieProfile.diet.subtitle}</Text>

        {optionsQuery.isLoading ? (
          <LoadingState title={t.onboarding.foodieProfile.optionsLoading} compact />
        ) : optionsQuery.isError ? (
          <DataErrorState error={optionsQuery.error} onRetry={() => void optionsQuery.refetch()} compact />
        ) : (
          <View style={styles.grid}>
            <FoodieProfileTileGrid options={options} selected={selected} onToggle={(code) => toggleDiet(code)} />
          </View>
        )}
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
  grid: {
    marginTop: spacing.lg,
  },
});
