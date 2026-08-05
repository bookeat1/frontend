import { colors, spacing } from "@bookeat/design-tokens";
import { LOCALES } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { GlobeSimple, WarningCircle } from "../../src/components/icons";
import { SelectRow } from "../../src/components/SelectRow";
import { useLocale } from "../../src/lib/locale";

/**
 * «Настройки» — the entry point reached from the gear/row on «Профиль».
 *
 * Two groups today: the interface language (opens the language picker, current
 * choice shown as the row's value) and an account group whose only action is
 * the soft delete. Both are the app's one navigation-row primitive (SelectRow),
 * not bespoke rows. Strings come from the CURRENT locale via useLocale, so the
 * screen re-renders in the chosen language.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { locale, dictionary: t } = useLocale();

  const currentLanguage = LOCALES.find((option) => option.code === locale)?.nativeName ?? "";

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.settings.title} onBack={() => router.back()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SelectRow
          icon={GlobeSimple}
          label={t.settings.language}
          value={currentLanguage}
          onPress={() => router.push("/settings/language")}
        />

        <SelectRow
          icon={WarningCircle}
          label={t.settings.account}
          value={t.settings.deleteAccount}
          caption={t.settings.deleteAccountCaption}
          onPress={() => router.push("/settings/delete-account")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
});
