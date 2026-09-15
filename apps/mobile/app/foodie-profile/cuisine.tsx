import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FoodieProfileHeader } from "../../src/components/foodie-profile/FoodieProfileHeader";
import { FoodieProfileTileGrid } from "../../src/components/foodie-profile/FoodieProfileTileGrid";
import { CUISINE_OPTIONS, cuisineOptionPhoto } from "../../src/components/foodie-profile/foodie-profile-options";
import { CUISINE_SELECTION_LIMIT } from "../../src/lib/foodie-profile-selection";
import { useFoodieProfileDraft } from "../../src/lib/foodie-profile-draft";

const t = getDictionary();

/**
 * Шаг 1/4 — «Любимая кухня» (Figma node 5161:11573).
 *
 * UI-ONLY: эндпоинта сохранения фуди-профиля на бэкенде нет — это отдельная
 * будущая задача. Экран только копит выбор в общем черновике визарда (см.
 * `useFoodieProfileDraft`) и передаёт его следующему шагу через Context.
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
  const selected = draft.cuisines;
  const atLimit = selected.length >= CUISINE_SELECTION_LIMIT;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FoodieProfileHeader
          step={1}
          onBack={() => router.back()}
          nextLabel={t.onboarding.foodieProfile.next}
          // Хотя бы одна кухня — иначе «Далее» серая, по конвенции остальных
          // экранов приложения («кнопка далее дизейблится без выбора»).
          nextEnabled={selected.length > 0}
          onNext={() => router.push("/foodie-profile/diet")}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.onboarding.foodieProfile.cuisine.title}
        </Text>
        <Text style={styles.subtitle}>{t.onboarding.foodieProfile.cuisine.subtitle}</Text>
        <Text style={styles.counter} accessibilityLiveRegion="polite">
          {t.onboarding.foodieProfile.cuisine.counter(selected.length)}
        </Text>
        {atLimit ? <Text style={styles.limitHint}>{t.onboarding.foodieProfile.cuisine.limitHint}</Text> : null}

        <View style={styles.grid}>
          <FoodieProfileTileGrid
            options={CUISINE_OPTIONS}
            selected={selected}
            disabledIds={atLimit ? new Set(CUISINE_OPTIONS.map((o) => o.id)) : undefined}
            labelFor={(id) =>
              t.onboarding.foodieProfile.cuisine.options[
                id as keyof typeof t.onboarding.foodieProfile.cuisine.options
              ]
            }
            photoFor={cuisineOptionPhoto}
            onToggle={(id) => toggleCuisine(id)}
            accessibilityHintFor={(_id, disabled) =>
              disabled ? t.onboarding.foodieProfile.cuisine.limitHint : undefined
            }
          />
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
