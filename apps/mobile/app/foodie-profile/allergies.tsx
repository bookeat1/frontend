import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DataErrorState } from "../../src/components/DataErrorState";
import { FoodieProfileHeader } from "../../src/components/foodie-profile/FoodieProfileHeader";
import { FoodieProfileTileGrid } from "../../src/components/foodie-profile/FoodieProfileTileGrid";
import { LoadingState } from "../../src/components/StateViews";
import { useFoodieOptions } from "../../src/hooks/useFoodieOptions";
import { useFoodieProfileDraft } from "../../src/lib/foodie-profile-draft";

const t = getDictionary();

/**
 * Шаг 3/4 — «Аллергии» (Figma node 5062:5841). Мультивыбор без лимита и без
 * эксклюзивных пунктов — проще экрана диет, ловить тут нечего.
 *
 * ВАРИАНТЫ — живой справочник (`useFoodieOptions()`), см. `cuisine.tsx` для
 * полного обоснования состояний загрузки/ошибки и того, почему
 * `draft.allergies` здесь уже никогда не содержит скрытый код (фильтрация —
 * в `FoodieProfileDraftProvider`, не на экране).
 */
export default function FoodieProfileAllergiesScreen() {
  const router = useRouter();
  const { draft, toggleAllergy } = useFoodieProfileDraft();
  const optionsQuery = useFoodieOptions();
  const selected = draft.allergies;
  const options = optionsQuery.data?.allergies ?? [];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FoodieProfileHeader
          step={3}
          onBack={() => router.back()}
          nextLabel={t.onboarding.foodieProfile.next}
          // В отличие от кухни (нужно выбрать хоть одну) и диеты (есть
          // эксклюзивный пункт «без диеты»), у аллергий нет пункта «нет
          // аллергий» — пустой выбор ЗДЕСЬ означает именно «нет аллергий», а
          // не «гость ещё не ответил». Требовать выбор было багом: гость без
          // аллергий не мог пройти дальше вовсе. Живой справочник всё равно
          // обязан загрузиться — без него «Далее» недоступна.
          nextEnabled={optionsQuery.isSuccess}
          onNext={() => router.push("/foodie-profile/budget")}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.onboarding.foodieProfile.allergies.title}
        </Text>
        <Text style={styles.subtitle}>{t.onboarding.foodieProfile.allergies.subtitle}</Text>

        {optionsQuery.isLoading ? (
          <LoadingState title={t.onboarding.foodieProfile.optionsLoading} compact />
        ) : optionsQuery.isError ? (
          <DataErrorState error={optionsQuery.error} onRetry={() => void optionsQuery.refetch()} compact />
        ) : (
          <View style={styles.grid}>
            <FoodieProfileTileGrid
              options={options}
              selected={selected}
              onToggle={(code) => toggleAllergy(code)}
            />
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
