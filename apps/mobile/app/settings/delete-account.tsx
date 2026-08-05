import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { OptionRow } from "../../src/components/OptionRow";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/lib/auth";
import { useLocale } from "../../src/lib/locale";

/**
 * «Удаление аккаунта» — soft delete with restore messaging.
 *
 * The screen is explicit that this is reversible for a while (restoreNotice)
 * and gates the destructive action behind a checkbox the guest must tick — the
 * button stays disabled until then. `deleteAccount()` is `DELETE /users/me`;
 * the retention window is the server's to define, so no number of days is
 * promised here (the endpoint is still being built — see the repository
 * contract).
 *
 * On success the guest is signed out (the token now belongs to a deleted
 * account, exactly the profile screen's sign-out path) and sent home. A double
 * tap is harmless: `inFlight` and the disabled state both guard it. A failure
 * keeps the checkbox ticked and lets the guest try again.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const { repository, signOut } = useAuth();
  const { dictionary: t } = useLocale();

  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  const submit = async () => {
    if (!confirmed || inFlight.current) return;
    inFlight.current = true;
    setDeleting(true);
    setFailed(false);
    try {
      await repository.deleteAccount();
      // The account is gone; drop the session the same way «Профиль» does and
      // return to a signed-out home rather than a screen keyed on a dead token.
      await signOut();
      router.replace("/");
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.deleteAccount.title} onBack={() => router.back()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{t.deleteAccount.heading}</Text>
        <Text style={styles.body}>{t.deleteAccount.explanation}</Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t.deleteAccount.restoreNotice}</Text>
        </View>

        <OptionRow
          role="checkbox"
          label={t.deleteAccount.confirmCheckbox}
          selected={confirmed}
          onPress={() => setConfirmed((prev) => !prev)}
        />

        <PrimaryButton
          label={deleting ? t.deleteAccount.deleting : t.deleteAccount.submit}
          onPress={() => void submit()}
          disabled={!confirmed || deleting}
        />

        {failed ? (
          <View style={styles.failure} accessibilityRole="alert">
            <Text style={styles.failureTitle}>{t.deleteAccount.errorTitle}</Text>
            <Text style={styles.failureBody}>{t.deleteAccount.errorDescription}</Text>
          </View>
        ) : null}
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
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  body: {
    ...typography.body,
    color: colors.text.primary,
  },
  notice: {
    backgroundColor: colors.background.chip,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  noticeText: {
    ...typography.body,
    color: colors.text.mutedStrong,
  },
  failure: {
    gap: spacing.xxs,
  },
  failureTitle: {
    ...typography.labelSemiBold,
    color: colors.brand.primary,
  },
  failureBody: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
