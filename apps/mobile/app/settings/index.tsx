import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { Bell, type IconProps, Info, Shield, WarningCircle } from "../../src/components/icons";
import { SelectRow } from "../../src/components/SelectRow";
import { ToggleRow } from "../../src/components/ToggleRow";
import { useLocale } from "../../src/lib/locale";
import { useNotificationsPref } from "../../src/lib/notifications-pref";

/**
 * «Настройки» — the entry point reached from the gear/row on «Профиль».
 *
 * Top to bottom: the design's group card — a notifications toggle, a
 * «Безопасность» row and the app-version row — and finally the account group
 * whose only action is the soft delete.
 *
 * Language selection lives on «Профиль», not here — the language row was
 * removed from Settings to match the design.
 *
 * Only the delete row navigates. «Безопасность» has no screen yet (track-C):
 * it is drawn NON-interactive with a muted «Скоро» rather than a chevron that
 * leads nowhere — a dead affordance is the same lie as a fake stat. The
 * version row is pure info. The notifications toggle is a genuinely stored
 * client preference (see useNotificationsPref), not a server switch.
 *
 * Strings come from the CURRENT locale via useLocale, so the screen re-renders
 * in the chosen language.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { dictionary: t } = useLocale();
  const { enabled: notificationsEnabled, setEnabled: setNotificationsEnabled } = useNotificationsPref();

  // Build/version read off the compiled app config, not hardcoded, so it stays
  // truthful across releases. iOS carries buildNumber (string), Android
  // versionCode (number) — take whichever this build has.
  const appVersion = Constants.expoConfig?.version ?? "";
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode?.toString() ?? "";
  const versionLabel = buildNumber ? `${appVersion} (${buildNumber})` : appVersion;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.settings.title} onBack={() => router.back()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ToggleRow
          icon={Bell}
          label={t.settings.notifications}
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />

        <InfoRow icon={Shield} label={t.settings.security} hint={t.settings.comingSoon} />

        <InfoRow icon={Info} label={t.settings.appName} hint={versionLabel} />

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

/**
 * A non-interactive chip row: leading icon, label, and a muted trailing hint
 * («Скоро» for a screen this app does not have yet, or the app version). No
 * chevron and no onPress — it must not look tappable when it leads nowhere.
 * Kept local to Settings; the profile menu has its own equivalent.
 */
function InfoRow({ icon: Icon, label, hint }: { icon: React.ComponentType<IconProps>; label: string; hint: string }) {
  return (
    <View style={styles.infoRow} accessibilityRole="text" accessibilityLabel={`${label}: ${hint}`}>
      <Icon size={24} color={colors.text.primary} weight="regular" />
      <Text style={styles.infoLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.infoHint} numberOfLines={1}>
        {hint}
      </Text>
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
  infoRow: {
    minHeight: hitSlop.minTouchTarget + spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  infoLabel: {
    ...typography.labelMedium,
    color: colors.text.primary,
    // Takes the free space so the hint pins to the right edge.
    flex: 1,
  },
  infoHint: {
    ...typography.body,
    color: colors.text.muted,
    // Bounded so the label keeps priority if both grow.
    flexShrink: 1,
    textAlign: "right",
  },
});
