import { colors, spacing } from "@bookeat/design-tokens";
import { LOCALES } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { OptionRow } from "../../src/components/OptionRow";
import { useLocale } from "../../src/lib/locale";

/**
 * «Язык интерфейса» — the seven locales by their own native name, the current
 * one checked. Tapping switches the app language through the LocaleProvider
 * (persisted) and pops back; the change is applied immediately because every
 * screen reads its dictionary from the same context.
 *
 * Each language is written in its OWN script (Қазақша, 한국어, العربية…) — a
 * language name is not a translated string, so it stays constant whatever the
 * current locale is. Falling back to Russian for any untranslated key is the
 * point of the partial-dictionary plumbing, not a gap to hide here.
 */
export default function LanguageScreen() {
  const router = useRouter();
  const { locale, setLocale, dictionary: t } = useLocale();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.settings.languageTitle} onBack={() => router.back()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {LOCALES.map((option) => (
          <OptionRow
            key={option.code}
            label={option.nativeName}
            caption={option.englishName}
            selected={option.code === locale}
            variant="plain"
            onPress={() => {
              setLocale(option.code);
              router.back();
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Белый лист, как в макете: серых плашек у языков нет, строки разделяет
    // только воздух.
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    paddingVertical: spacing.sm,
  },
});
