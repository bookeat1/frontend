import type { AuthUser } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookingCard } from "../src/components/booking/BookingCard";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { FlowHeader } from "../src/components/FlowHeader";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { BookOpen, Heart } from "../src/components/icons";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { useAuth } from "../src/lib/auth";

const t = getDictionary();

/**
 * «Профиль» — the account behind the bookings (`GET /users/me`).
 *
 * The account is re-read here with its own query instead of using the
 * `user` the auth context keeps: that one is a best-effort prefill for the
 * booking form (a failed /users/me is swallowed there on purpose), which
 * means it cannot tell "still loading" from "the request failed". A screen
 * whose entire content is the account has to be able to say which.
 *
 * Nothing here is editable: there is a `PATCH /users/me` on the backend, but
 * an edit form is a feature with its own validation and error surface, not a
 * side effect of building a tab. Only what the API really returns is shown.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { status, repository, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => repository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });

  const handleSignOut = async () => {
    // Double-tap guard on top of the disabled button: signing out twice is
    // harmless, but a second run while the first is writing SecureStore is not
    // something to rely on.
    if (signingOut) return;
    setSigningOut(true);
    try {
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
        ) : status === "signed-out" ? (
          <EmptyState
            title={t.profile.signedOutTitle}
            description={t.profile.signedOutDescription}
            actionLabel={t.profile.signIn}
            onAction={() => router.push("/auth/sign-in")}
          />
        ) : me.isPending ? (
          <LoadingState title={t.profile.loadingTitle} />
        ) : me.isError ? (
          <ErrorState
            title={t.profile.errorTitle}
            description={t.profile.errorDescription}
            retryLabel={t.common.retry}
            onRetry={() => void me.refetch()}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <BookingCard title={t.profile.accountTitle}>
              <Field label={t.profile.nameLabel} value={me.data.fullName || t.profile.nameEmpty} />
              <Field label={t.profile.emailLabel} value={me.data.email} />
              <Field label={t.profile.phoneLabel} value={me.data.phone ?? t.profile.phoneEmpty} />
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
