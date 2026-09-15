import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FoodieProfileHeader } from "../../src/components/foodie-profile/FoodieProfileHeader";
import { FoodieProfileTileGrid } from "../../src/components/foodie-profile/FoodieProfileTileGrid";
import { ALLERGY_OPTIONS } from "../../src/components/foodie-profile/foodie-profile-options";
import { useFoodieProfileDraft } from "../../src/lib/foodie-profile-draft";

const t = getDictionary();

/**
 * Шаг 3/4 — «Аллергии» (Figma node 5062:5841). Мультивыбор без лимита и без
 * эксклюзивных пунктов — проще экрана диет, ловить тут нечего.
 */
export default function FoodieProfileAllergiesScreen() {
  const router = useRouter();
  const { draft, toggleAllergy } = useFoodieProfileDraft();
  const selected = draft.allergies;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FoodieProfileHeader
          step={3}
          onBack={() => router.back()}
          nextLabel={t.onboarding.foodieProfile.next}
          nextEnabled={selected.length > 0}
          onNext={() => router.push("/foodie-profile/budget")}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.onboarding.foodieProfile.allergies.title}
        </Text>
        <Text style={styles.subtitle}>{t.onboarding.foodieProfile.allergies.subtitle}</Text>

        <View style={styles.grid}>
          <FoodieProfileTileGrid
            options={ALLERGY_OPTIONS}
            selected={selected}
            labelFor={(id) =>
              t.onboarding.foodieProfile.allergies.options[
                id as keyof typeof t.onboarding.foodieProfile.allergies.options
              ]
            }
            onToggle={(id) => toggleAllergy(id)}
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
  grid: {
    marginTop: spacing.lg,
  },
});
