import type { AuthUser } from "@bookeat/api";
import { colors, radius, spacing } from "@bookeat/design-tokens";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { FieldEditorSheet } from "../../src/components/profile/FieldEditorSheet";
import { PersonalDataRow } from "../../src/components/profile/PersonalDataRow";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";
import { useAuth } from "../../src/lib/auth";
import { useLocale } from "../../src/lib/locale";
import { formatStoredPhoneForDisplay } from "../../src/lib/phone";
import { classifyProfileSaveFailure } from "../../src/lib/profile-edit";

/**
 * «Персональные данные» — the list half of the account edit flow (Figma
 * render): two rows, «Имя» and «Номер телефона», each showing the current
 * value. «Имя» opens a bottom-sheet editor and saves through the SAME PATCH
 * /users/me the profile edit form uses (repository.updateMe).
 *
 * «Номер телефона» is NOT a `PATCH /users/me` field — `updateMeRequest` has no
 * phone, and OTP sign-in finds-or-creates the account BY the number, so moving
 * it safely needs a re-verification flow: send a code to the NEW number, prove
 * it, then move the account. That flow now exists (app/profile/change-phone.tsx
 * over POST /users/me/phone/otp/request + /verify), so the row routes into it
 * instead of a PATCH — never a fake save the backend would silently ignore.
 *
 * The `me` query, the session-dies-mid-edit guard (`keepEditor` + `lastUser`)
 * and the four states mirror app/profile/edit.tsx on purpose — this is the same
 * account, read the same way.
 */
export default function PersonalDataScreen() {
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, repository } = useAuth();

  const [keepEditor, setKeepEditor] = useState(false);
  const [editing, setEditing] = useState<"name" | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>(undefined);
  // Guards a double tap in the window before `saving` has re-rendered — a
  // second PATCH is not destructive but spends a request and can answer out of
  // order (same guard ProfileForm uses).
  const inFlight = useRef(false);

  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => repository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });

  // The last profile that actually loaded. The ["me"] cache entry is REMOVED on
  // sign-out (auth.tsx: PRIVATE_QUERY_KEYS), so without this the sheet would
  // lose the account it is editing the moment the session dies mid-save.
  const lastUser = useRef<AuthUser | null>(null);
  useEffect(() => {
    if (me.data) lastUser.current = me.data;
  }, [me.data]);
  const account = me.data ?? (keepEditor ? lastUser.current : null);

  const openNameEditor = () => {
    setServerError(undefined);
    setEditing("name");
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setServerError(undefined);
  };

  const submitName = async (value: string) => {
    if (inFlight.current) return;
    // Nothing changed — no need to spend a request. What the guest sees IS what
    // is stored, so just close.
    if (account && value === account.fullName) {
      setEditing(null);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setServerError(undefined);
    try {
      const updated = await repository.updateMe({ fullName: value });
      queryClient.setQueryData(["me"], updated);
      setEditing(null);
    } catch (error) {
      // The draft is not touched: whatever the guest typed is still in the
      // sheet, whichever way this failed.
      const reason = classifyProfileSaveFailure(error);
      const f = t.profile.edit.failure;
      setServerError(
        reason === "session_expired"
          ? f.sessionExpired
          : reason === "rejected"
            ? f.rejected
            : reason === "offline"
              ? f.offline
              : f.unknown,
      );
      if (reason === "session_expired") setKeepEditor(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.profile.personalData.title} onBack={() => router.back()} />
      </SafeAreaView>

      <View style={styles.body}>
        {status === "loading" ? (
          <LoadingState title={t.profile.loadingTitle} />
        ) : status === "signed-out" && !account ? (
          <EmptyState
            title={t.profile.signedOutTitle}
            description={t.profile.signedOutDescription}
            action={{
              label: t.profile.signIn,
              onPress: () => router.push("/auth/sign-in"),
              variant: "button",
            }}
          />
        ) : !account ? (
          me.isError ? (
            <ErrorState
              title={t.profile.errorTitle}
              description={t.profile.errorDescription}
              action={{
                label: t.common.retry,
                onPress: () => void me.refetch(),
                variant: "button",
              }}
            />
          ) : (
            <LoadingState title={t.profile.loadingTitle} />
          )
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.group}>
              <PersonalDataRow
                label={t.profile.personalData.nameRow}
                value={account.fullName}
                placeholder={t.profile.personalData.nameEmpty}
                onPress={openNameEditor}
                editA11y={t.profile.personalData.editNameA11y}
              />
              <PersonalDataRow
                label={t.profile.personalData.phoneRow}
                value={account.phone ? formatStoredPhoneForDisplay(account.phone) : ""}
                placeholder={t.profile.personalData.phoneEmpty}
                onPress={() => router.push("/profile/change-phone")}
                editA11y={t.profile.personalData.editPhoneA11y}
              />
            </View>
          </ScrollView>
        )}
      </View>

      <FieldEditorSheet
        visible={editing === "name"}
        title={t.profile.personalData.nameEditorTitle}
        label={t.profile.personalData.nameRow}
        initialValue={account?.fullName ?? ""}
        placeholder={t.profile.personalData.nameInputPlaceholder}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        saving={saving}
        serverError={serverError}
        requiredError={t.profile.edit.errors.name_required}
        saveLabel={t.profile.edit.save}
        savingLabel={t.profile.edit.saving}
        onSubmit={(value) => void submitName(value)}
        onCancel={closeEditor}
      />
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
  body: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  group: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.card,
    overflow: "hidden",
  },
});
