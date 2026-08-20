import type { AuthUser } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { TextField } from "../../src/components/TextField";
import { useAuth } from "../../src/lib/auth";
import { useLocale } from "../../src/lib/locale";
import { classifyProfileSaveFailure } from "../../src/lib/profile-edit";

/**
 * Mandatory name step, shown ONCE right after a first sign-in when the freshly
 * created account has no name yet (sign-in.tsx routes here instead of leaving
 * the gate). The name is required — it is what gets stamped onto every booking
 * — so this screen is a wall, not a form the guest can skip:
 *
 *   - no back arrow (FlowHeader without `onBack`);
 *   - the iOS swipe-back gesture is disabled (`gestureEnabled: false`);
 *   - the Android hardware back button is swallowed (BackHandler returns true);
 *
 * so there is no path out of it that leaves a signed-in-but-nameless guest in
 * the app. The only way forward is a non-empty name, saved through the SAME
 * PATCH /users/me the profile editor uses (repository.updateMe → ["me"] cache),
 * after which we `replace` to the birthday step — replace, not push, so this
 * step is not on the back stack afterwards.
 */
export default function OnboardingNameScreen() {
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { repository } = useAuth();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  // Guards a double tap in the window before `saving` has re-rendered — a
  // second PATCH is not destructive but spends a request and can answer out of
  // order (same guard the profile editor uses).
  const inFlight = useRef(false);

  // Swallow the Android hardware back button: there is nowhere to go back to
  // that isn't "signed in with no name". Returning true tells Android the
  // event was handled, so it does not pop the screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !saving;

  const save = useCallback(async () => {
    if (inFlight.current || trimmed.length === 0) return;
    inFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const updated: AuthUser = await repository.updateMe({ fullName: trimmed });
      // Feed the same cache the rest of the app reads, so Home/Profile show the
      // name immediately without a refetch.
      queryClient.setQueryData(["me"], updated);
      // Дальше — шаг с датой рождения (правка владельца 2026-08-20). replace,
      // а не push: имя уже сохранено, и возвращаться к этому шагу незачем.
      router.replace("/onboarding/birthday");
    } catch (err) {
      const reason = classifyProfileSaveFailure(err);
      const f = t.profile.edit.failure;
      setError(
        reason === "session_expired"
          ? f.sessionExpired
          : reason === "rejected"
            ? f.rejected
            : reason === "offline"
              ? f.offline
              : f.unknown,
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [trimmed, repository, queryClient, router, t]);

  return (
    <View style={styles.root}>
      {/* Kill the iOS swipe-back gesture for this route: the header already
          has no arrow, and the gesture would otherwise let the guest slip back
          to the screen underneath while still nameless. */}
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />

      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        {/* No onBack → no arrow. This step has no way out but forward. */}
        <FlowHeader title="" />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading} accessibilityRole="header">
            {t.onboarding.name.title}
          </Text>
          <Text style={styles.subtitle}>{t.onboarding.name.subtitle}</Text>

          <TextField
            label={t.onboarding.name.label}
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError(undefined);
            }}
            placeholder={t.onboarding.name.placeholder}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            editable={!saving}
            error={error}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
          />

          <PrimaryButton
            label={saving ? t.onboarding.name.saving : t.onboarding.name.save}
            size="lg"
            onPress={() => void save()}
            disabled={!canSave}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  flex: {
    flex: 1,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heading: {
    ...typography.titleXl,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: -spacing.sm,
  },
});
