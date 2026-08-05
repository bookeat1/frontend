import type { AuthUser } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookingCard } from "../src/components/booking/BookingCard";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { FlowHeader } from "../src/components/FlowHeader";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { BookOpen, GearSix, Heart } from "../src/components/icons";
import { ProfileForm } from "../src/components/profile/ProfileForm";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { useAuth } from "../src/lib/auth";
import { requestCitySelection } from "../src/lib/city-select";
import { useLocale } from "../src/lib/locale";

/**
 * «Профиль» — the account behind the bookings (`GET /users/me`).
 *
 * The account is re-read here with its own query instead of using the
 * `user` the auth context keeps: that one is a best-effort prefill for the
 * booking form (a failed /users/me is swallowed there on purpose), which
 * means it cannot tell "still loading" from "the request failed". A screen
 * whose entire content is the account has to be able to say which.
 *
 * Editing goes through `PATCH /users/me` and covers exactly the fields that
 * endpoint accepts AND this app has an honest value for: name, city, birth
 * date. The phone is displayed but not editable — there is no phone field in
 * the PATCH body and the account is found BY the number at sign-in. See
 * ProfileForm for the fields deliberately left out.
 *
 * One piece of wiring worth naming: when a refresh fails mid-edit the auth
 * context signs the guest out, which would normally swap this screen for «Вы
 * не вошли» and take their unsaved text with it. `keepEditor` pins the form in
 * place for that case, and `lastUser` keeps the profile it was built from
 * after the ["me"] cache entry is purged on sign-out.
 */
export default function ProfileScreen() {
  // The settings entry point reads the dictionary through the context so it
  // re-renders in the chosen language the instant it changes, without waiting
  // for a reload — the switch itself lives one tap deeper (in /settings).
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, repository, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const [keepEditor, setKeepEditor] = useState(false);

  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => repository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });

  // The last profile that actually loaded. The ["me"] cache entry is REMOVED on
  // sign-out (auth.tsx: PRIVATE_QUERY_KEYS), so without this the form would
  // lose the account it is editing at the exact moment the session dies.
  const lastUser = useRef<AuthUser | null>(null);
  useEffect(() => {
    if (me.data) lastUser.current = me.data;
  }, [me.data]);
  const account = me.data ?? (keepEditor ? lastUser.current : null);

  const handleSignOut = async () => {
    // Double-tap guard on top of the disabled button: signing out twice is
    // harmless, but a second run while the first is writing SecureStore is not
    // something to rely on.
    if (signingOut) return;
    setSigningOut(true);
    try {
      // An explicit sign-out is not a session that died under the guest: the
      // editor must go with it, not be pinned open holding the previous
      // person's name.
      setKeepEditor(false);
      lastUser.current = null;
      await signOut();
      router.replace("/");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.profile.title} />
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
              />
            </BookingCard>

            <BookingCard>
              <PrimaryButton
                variant="secondary"
                icon={BookOpen}
                label={t.profile.myBookings}
                onPress={() => router.replace("/bookings")}
              />
              <PrimaryButton
                variant="secondary"
                icon={Heart}
                label={t.profile.myFavorites}
                onPress={() => router.replace("/favorites")}
              />
              <PrimaryButton
                variant="secondary"
                icon={GearSix}
                label={t.profile.settings}
                onPress={() => router.push("/settings")}
              />
            </BookingCard>

            <View style={styles.signOut}>
              <PrimaryButton
                variant="secondary"
                label={signingOut ? t.profile.signingOut : t.profile.signOut}
                onPress={() => void handleSignOut()}
                disabled={signingOut}
              />
            </View>
          </ScrollView>
        )}
      </View>

      <BottomNavBar />
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
  signOut: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.card,
  },
});
