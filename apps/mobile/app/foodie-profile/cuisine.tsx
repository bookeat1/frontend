import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Stack, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DataErrorState } from "../../src/components/DataErrorState";
import { cuisineOptionPhoto } from "../../src/components/foodie-profile/foodie-profile-options";
import { FoodieProfileHeader } from "../../src/components/foodie-profile/FoodieProfileHeader";
import { FoodieProfileTileGrid } from "../../src/components/foodie-profile/FoodieProfileTileGrid";
import { LoadingState } from "../../src/components/StateViews";
import { useFoodieOptions } from "../../src/hooks/useFoodieOptions";
import { useFoodieProfileDraft } from "../../src/lib/foodie-profile-draft";
import { CUISINE_SELECTION_LIMIT } from "../../src/lib/foodie-profile-selection";
import { withHiddenSelected } from "../../src/lib/foodie-profile-visible-options";

const t = getDictionary();

/**
 * Шаг 1/4 — «Любимая кухня» (Figma node 5161:11573).
 *
 * ВАРИАНТЫ — живой справочник платформы (`useFoodieOptions()`, `GET
 * /foodie-profile/options`, спека foodie-profile-admin-dictionaries-
 * 20260916), не вшитый список: суперадмин заводит/переименовывает/прячет
 * кухню без релиза сборки. Пока справочник грузится — крутилка, «Далее»
 * недоступна; сбой сети — общий `DataErrorState` с «Повторить», тоже без
 * возможности пройти дальше (вшитого запасного списка нет нарочно, см.
 * `onboarding.foodieProfile.optionsLoading`).
 *
 * СКРЫТЫЙ, НО ВЫБРАННЫЙ. Черновик может нести код кухни, которую админ уже
 * скрыл (сценарий 3.5 спеки) — сервер её в `options` больше не пришлёт.
 * `withHiddenSelected` подмешивает такую плитку в конец списка отмеченной,
 * с запасной подписью (код без перевода), а не молча теряет выбор гостя.
 *
 * ЛИМИТ 5 — ТАП ПО ШЕСТОЙ БЛОКИРУЕТСЯ, а не вытесняет самую старую выбранную
 * (решение агента, задача оставляла его на усмотрение реализации). Полное
 * обоснование — в `foodie-profile-selection.ts`. Видимость решения: плитки,
 * недостижимые при наборе лимита, притушены (`disabled` в `SelectableTile`) и
 * счётчик печатает подсказку, а не молчит.
 */
export default function FoodieProfileCuisineScreen() {
  const router = useRouter();
  const { draft, toggleCuisine } = useFoodieProfileDraft();
  const optionsQuery = useFoodieOptions();
  const selected = draft.cuisines;
  const atLimit = selected.length >= CUISINE_SELECTION_LIMIT;

  const options = useMemo(
    () => withHiddenSelected(optionsQuery.data?.cuisines ?? [], selected),
    [optionsQuery.data, selected],
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FoodieProfileHeader
          step={1}
          onBack={() => router.back()}
          nextLabel={t.onboarding.foodieProfile.next}
          // Хотя бы одна кухня И живой справочник — иначе «Далее» серая, по
          // конвенции остальных экранов приложения.
          nextEnabled={optionsQuery.isSuccess && selected.length > 0}
          onNext={() => router.push("/foodie-profile/diet")}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.onboarding.foodieProfile.cuisine.title}
        </Text>
        <Text style={styles.subtitle}>{t.onboarding.foodieProfile.cuisine.subtitle}</Text>

        {optionsQuery.isLoading ? (
          <LoadingState title={t.onboarding.foodieProfile.optionsLoading} compact />
        ) : optionsQuery.isError ? (
          <DataErrorState error={optionsQuery.error} onRetry={() => void optionsQuery.refetch()} compact />
        ) : (
          <>
            <Text style={styles.counter} accessibilityLiveRegion="polite">
              {t.onboarding.foodieProfile.cuisine.counter(selected.length)}
            </Text>
            {atLimit ? (
              <Text style={styles.limitHint}>{t.onboarding.foodieProfile.cuisine.limitHint}</Text>
            ) : null}

            <View style={styles.grid}>
              <FoodieProfileTileGrid
                options={options}
                selected={selected}
                disabledIds={atLimit ? new Set(options.map((o) => o.code)) : undefined}
                photoFor={cuisineOptionPhoto}
                onToggle={(code) => toggleCuisine(code)}
                accessibilityHintFor={(_code, disabled) =>
                  disabled ? t.onboarding.foodieProfile.cuisine.limitHint : undefined
                }
              />
            </View>
          </>
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
  counter: {
    ...typography.labelSemiBold,
    color: colors.brand.primary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  limitHint: {
    ...typography.caption,
    color: colors.text.navInactive,
    textAlign: "center",
    marginTop: spacing.xxs,
  },
  grid: {
    marginTop: spacing.lg,
  },
});
