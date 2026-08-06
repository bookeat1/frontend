import type { AuthUser } from "@bookeat/api";
import { colors, radius, spacing } from "@bookeat/design-tokens";
import { LOCALES } from "@bookeat/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { ChatCircle, ForkKnife, GearSix, GlobeSimple, MapPin, Question, SignOut, ThumbsUp, User } from "../src/components/icons";
import { ProfileIdentity } from "../src/components/profile/ProfileIdentity";
import { ProfileLogoutSheet } from "../src/components/profile/ProfileLogoutSheet";
import { ProfileMenuRow } from "../src/components/profile/ProfileMenuRow";
import { ProfileStats } from "../src/components/profile/ProfileStats";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { useMyBookings } from "../src/hooks/useBooking";
import { useAuth } from "../src/lib/auth";
import { requestCitySelection } from "../src/lib/city-select";
import { useLocale } from "../src/lib/locale";

/**
 * «Профиль» — a display vitrina, not an edit form (Figma profile reference).
 *
 * The account is re-read here with its own query instead of the best-effort
 * `user` the auth context keeps for the booking form (a failed /users/me is
 * swallowed there on purpose, so it cannot tell "loading" from "failed"); a
 * screen that IS the account has to say which.
 *
 * Editing moved off this screen entirely: the identity block at the top is the
 * entry point (`/profile/edit`), where the same ProfileForm and PATCH
 * /users/me wiring now lives. The vitrina only reads — name, phone, one real
 * counter, the current city and language — and routes.
 */
export default function ProfileScreen() {
  // The dictionary comes through the context so this screen re-renders in the
  // chosen language the instant it changes (the switch lives in /settings/language).
  const { dictionary: t, locale } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, repository, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => repository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });
  const account = me.data ?? null;

  // «Брони» — the only stat with a backend behind it: the same list the bookings
  // screen reads (`GET /bookings`), whose first page carries the true `total`.
  // Session-gated inside the hook, so a signed-out guest never fires it.
  // «Отзывов» and «Друзья» have no endpoint yet — shown as a real 0 below, not
  // a plausible-looking number. TODO(track-C backend): wire when they exist.
  const bookings = useMyBookings();
  const bookingsCount = bookings.data?.pages[0]?.total ?? 0;

  const currentLanguage = LOCALES.find((option) => option.code === locale)?.nativeName ?? "";

  const handleSignOut = async () => {
    // Double-tap guard on top of the disabled button: signing out twice is
    // harmless, but a second run while the first is writing SecureStore is not
    // something to rely on.
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      setConfirmingSignOut(false);
      router.replace("/");
    } finally {
      setSigningOut(false);
    }
  };

  // Opening the city picker straight from the vitrina: persist the choice with
  // the same PATCH /users/me the edit form uses, writing the server's answer
  // back into the ["me"] cache so the row updates without a refetch. The cache
  // is touched only on success, so a failed save simply leaves the stored city
  // in place — no invented value on screen.
  const editCity = () => {
    requestCitySelection((city) => {
      void repository
        .updateMe({ city: city ?? "" })
        .then((updated) => queryClient.setQueryData(["me"], updated))
        .catch(() => {
          // Keep the last stored city; the row already shows the real value.
        });
    });
    router.push({ pathname: "/city", params: { selected: account?.city ?? "", purpose: "profile" } });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.topSafeArea} />

      <View style={styles.body}>
        {status === "loading" ? (
          <LoadingState title={t.profile.loadingTitle} />
        ) : status === "signed-out" || !account ? (
          status === "signed-out" ? (
            <EmptyState
              title={t.profile.signedOutTitle}
              description={t.profile.signedOutDescription}
              actionLabel={t.profile.signIn}
              onAction={() => router.push("/auth/sign-in")}
            />
          ) : me.isError ? (
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
            <ProfileIdentity
              name={account.fullName}
              phone={account.phone}
              editLabel={t.profile.editIdentityA11y}
              namePlaceholder={t.profile.nameEmpty}
              onPress={() => router.push("/profile/edit")}
            />

            <ProfileStats
              bookings={bookingsCount}
              reviews={0}
              friends={0}
              labels={t.profile.stats}
              // Same destination as the «Мои брони» tab — the count is a shortcut.
              onPressBookings={() => router.push("/bookings")}
            />

            {/* Фуди-профиль / Мои отзывы — track-C: no screen yet, so both rows
                are non-interactive «Скоро» rather than dead chevrons.
                TODO(track-C backend): give them an onPress once the screens land. */}
            <View style={styles.group}>
              <ProfileMenuRow
                icon={ForkKnife}
                label={t.profile.menu.foodProfile}
                comingSoonLabel={t.profile.comingSoon}
              />
              <Divider />
              <ProfileMenuRow
                icon={ChatCircle}
                label={t.profile.menu.myReviews}
                comingSoonLabel={t.profile.comingSoon}
              />
            </View>

            <View style={styles.group}>
              <ProfileMenuRow
                icon={User}
                label={t.profile.menu.personalData}
                onPress={() => router.push("/profile/personal-data")}
                comingSoonLabel={t.profile.comingSoon}
              />
              <Divider />
              <ProfileMenuRow
                icon={MapPin}
                label={t.profile.menu.city}
                value={account.city || t.profile.menu.cityEmpty}
                onPress={editCity}
                comingSoonLabel={t.profile.comingSoon}
              />
              <Divider />
              <ProfileMenuRow
                icon={GlobeSimple}
                label={t.profile.menu.language}
                value={currentLanguage}
                onPress={() => router.push("/settings/language")}
                comingSoonLabel={t.profile.comingSoon}
              />
            </View>

            {/* Центр помощи / Оценить приложение — track-C placeholders; Настройки
                is real. TODO(track-C backend): wire the first two. */}
            <View style={styles.group}>
              <ProfileMenuRow
                icon={Question}
                label={t.profile.menu.helpCenter}
                comingSoonLabel={t.profile.comingSoon}
              />
              <Divider />
              <ProfileMenuRow
                icon={ThumbsUp}
                label={t.profile.menu.rateApp}
                comingSoonLabel={t.profile.comingSoon}
              />
              <Divider />
              <ProfileMenuRow
                icon={GearSix}
                label={t.profile.settings}
                onPress={() => router.push("/settings")}
                comingSoonLabel={t.profile.comingSoon}
              />
            </View>

            <View style={styles.group}>
              <ProfileMenuRow
                icon={SignOut}
                label={t.profile.logout.row}
                onPress={() => setConfirmingSignOut(true)}
                comingSoonLabel={t.profile.comingSoon}
              />
            </View>
          </ScrollView>
        )}
      </View>

      <ProfileLogoutSheet
        visible={confirmingSignOut}
        signingOut={signingOut}
        title={t.profile.logout.confirmTitle}
        confirmLabel={t.profile.logout.confirm}
        confirmBusyLabel={t.profile.signingOut}
        cancelLabel={t.profile.logout.cancel}
        onConfirm={() => void handleSignOut()}
        onCancel={() => setConfirmingSignOut(false)}
      />

      <BottomNavBar />
    </View>
  );
}

/** Hairline between rows of one menu group, inset past the leading icon so it
 * reads as "same group" rather than a full-bleed cut. */
function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  topSafeArea: {
    backgroundColor: colors.background.screen,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 24 + spacing.md,
    backgroundColor: colors.border.control,
  },
});
