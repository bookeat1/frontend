import type { AuthUser } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookingCard } from "../../src/components/booking/BookingCard";
import { FlowHeader } from "../../src/components/FlowHeader";
import { ProfileForm } from "../../src/components/profile/ProfileForm";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";
import { useAuth } from "../../src/lib/auth";
import { requestCitySelection } from "../../src/lib/city-select";
import { useLocale } from "../../src/lib/locale";

/**
 * «Редактировать профиль» — the editable half of the account, moved off the
 * «Профиль» vitrina (app/profile.tsx) behind a tap on the identity block. The
 * vitrina is a display surface; this is where name / city / birth date change.
 *
 * The wiring is exactly what lived on the profile screen before the split — the
 * `me` query, the city picker hand-off, and the session-dies-mid-edit guard
 * (`keepEditor` + `lastUser`) that keeps this form mounted, holding the guest's
 * unsaved text, instead of swapping in «Вы не вошли» the moment the token
 * expires. See ProfileForm for why the draft is the one thing that must survive.
 */
export default function ProfileEditScreen() {
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, repository } = useAuth();

  const [keepEditor, setKeepEditor] = useState(false);

  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => repository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });

  // The last profile that actually loaded. The ["me"] cache entry is REMOVED on
  // sign-out (auth.tsx: PRIVATE_QUERY_KEYS), so without this the form would lose
  // the account it is editing at the exact moment the session dies.
  const lastUser = useRef<AuthUser | null>(null);
  useEffect(() => {
    if (me.data) lastUser.current = me.data;
  }, [me.data]);
  const account = me.data ?? (keepEditor ? lastUser.current : null);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.profile.editTitle} onBack={() => router.back()} />
      </SafeAreaView>

      <View style={styles.body}>
        {status === "loading" ? (
          <LoadingState title={t.profile.loadingTitle} />
        ) : status === "signed-out" && !account ? (
          <EmptyState
            title={t.profile.signedOutTitle}
            description={t.profile.signedOutDescription}
            actionLabel={t.profile.signIn}
            onAction={() => router.push("/auth/sign-in")}
          />
        ) : !account ? (
          me.isError ? (
            <ErrorState
              title={t.profile.errorTitle}
              description={t.profile.errorDescription}
              retryLabel={t.common.retry}
              onRetry={() => void me.refetch()}
            />
          ) : (
            <LoadingState title={t.profile.loadingTitle} />
          )
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <BookingCard title={t.profile.accountTitle}>
              {/* An account created by phone code has no email at all — the
                  backend leaves it blank (usecase/auth/otp.go creates the user
                  with a phone and nothing else). An empty line under «Почта»
                  looks like a failed load, so say it plainly. The email is NOT
                  editable: PATCH /users/me has no email field. */}
              <Field label={t.profile.emailLabel} value={account.email || t.profile.emailEmpty} />
              <ProfileForm
                user={account}
                onSave={(patch) => repository.updateMe(patch)}
                onSaved={(updated) => queryClient.setQueryData(["me"], updated)}
                onSessionExpired={() => setKeepEditor(true)}
                onSignIn={() => router.push("/auth/sign-in")}
                // Opening the city picker lives here (the form is router-free so
                // it stays mountable in a test): leave the setter in the mailbox,
                // then push the picker. `apply` is the form's own patchField.
                onEditCity={(current, apply) => {
                  requestCitySelection((city) => apply(city ?? ""));
                  router.push({ pathname: "/city", params: { selected: current, purpose: "profile" } });
                }}
                // Same change-phone flow as /profile/personal-data: the row is
                // navigation, so the router lives here, not in the form.
                onEditPhone={() => router.push("/profile/change-phone")}
              />
            </BookingCard>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

/** Label above value — the same two-line shape the reservation cards use. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
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
  body: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xxs,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  fieldValue: {
    ...typography.body,
    color: colors.text.primary,
  },
});
