import type { AuthUser } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { LOCALES } from "@bookeat/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { GearSix, GlobeSimple, Heart, MapPin, SignOut, User} from "../src/components/icons";
import { ProfileIdentity } from "../src/components/profile/ProfileIdentity";
import { ProfileLogoutSheet } from "../src/components/profile/ProfileLogoutSheet";
import { ProfileMenuRow } from "../src/components/profile/ProfileMenuRow";
import { ProfileStats } from "../src/components/profile/ProfileStats";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { useMyBookings } from "../src/hooks/useBooking";
import { useAuth } from "../src/lib/auth";
import { pickAndUploadAvatar } from "../src/lib/avatar-upload";
import { membershipDuration } from "../src/lib/format";
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
  const navPad = useNavBarSpacing();
  // The dictionary comes through the context so this screen re-renders in the
  // chosen language the instant it changes (the switch lives in /settings/language).
  const { dictionary: t, locale } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, repository, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
  /**
   * Смена фотографии профиля. Отказ в доступе к галерее и сбой отправки — это
   * РАЗНЫЕ сообщения: первое чинится только в настройках телефона, и «попробуйте
   * ещё раз» там было бы издевательством. Закрытая без выбора галерея молчит —
   * человек передумал, ему нечего сообщать.
   */
  const changeAvatar = useCallback(async () => {
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const outcome = await pickAndUploadAvatar(repository);
      if (outcome.kind === "uploaded") {
        // Сервер уже сохранил ссылку в профиль — перечитываем его, чтобы экран
        // показывал то, что лежит на сервере, а не то, что мы предположили.
        await queryClient.invalidateQueries({ queryKey: ["me"] });
      } else if (outcome.kind === "denied") {
        setAvatarError(t.profile.avatarPermissionDenied);
      } else if (outcome.kind === "failed") {
        setAvatarError(
          outcome.reason === "too_large"
            ? t.profile.avatarTooLarge
            : outcome.reason === "bad_format"
              ? t.profile.avatarBadFormat
              : t.profile.avatarUploadFailed,
        );
      }
    } finally {
      setAvatarUploading(false);
    }
  }, [queryClient, repository, t]);

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
              action={{
                label: t.profile.signIn,
                onPress: () => router.push("/auth/sign-in"),
                variant: "button",
              }}
            />
          ) : me.isError ? (
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
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navPad }]} showsVerticalScrollIndicator={false}>
            {/* Имя со сроком в BookEat и плашки статистики — одна группа:
                между ними 24 (макет 979:7752), а не общие 32, которыми
                разделены группы меню ниже. */}
            <View style={styles.identityGroup}>
              <ProfileIdentity
                name={account.fullName}
                phone={account.phone}
                membership={membershipDuration(account.createdAt, {
                  days: t.profile.membershipDays,
                  weeks: t.profile.membershipWeeks,
                  months: t.profile.membershipMonths,
                  years: t.profile.membershipYears,
                })}
                avatarUrl={account.avatarUrl}
                editLabel={t.profile.changeAvatarA11y}
                namePlaceholder={t.profile.nameEmpty}
                uploading={avatarUploading}
                onPress={() => void changeAvatar()}
              />

              {avatarError ? (
                <Text style={styles.avatarError} accessibilityRole="alert">
                  {avatarError}
                </Text>
              ) : null}

              <ProfileStats
                bookings={bookingsCount}
                reviews={0}
                friends={0}
                labels={t.profile.stats}
                // Same destination as the «Мои брони» tab — the count is a shortcut.
                onPressBookings={() => router.push("/bookings")}
              />
            </View>

            {/* «Избранные» стоит первой строкой сразу под счётчиком броней:
                вкладки внизу у избранного больше нет (её место занял
                гастрогид), и искать вход гость будет здесь, рядом с бронями,
                а не внизу у «Выйти».

                СТРОК «СКОРО» ЗДЕСЬ БОЛЬШЕ НЕТ (обратная связь живого гостя,
                24.08.2026). Фуди-профиль, отзывы, центр помощи и оценка
                приложения были нерабочими подписями: обещание в меню, за
                которым ничего не открывается, раздражает сильнее, чем
                отсутствие пункта. Строки вернутся вместе со своими экранами,
                а не раньше. */}
            <View style={styles.group}>
              <ProfileMenuRow
                icon={Heart}
                label={t.profile.menu.favorites}
                onPress={() => router.push("/favorites")}
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
              <ProfileMenuRow
                icon={MapPin}
                label={t.profile.menu.city}
                value={account.city || t.profile.menu.cityEmpty}
                onPress={editCity}
                comingSoonLabel={t.profile.comingSoon}
              />
              <ProfileMenuRow
                icon={GlobeSimple}
                label={t.profile.menu.language}
                value={currentLanguage}
                onPress={() => router.push("/settings/language")}
                comingSoonLabel={t.profile.comingSoon}
              />
            </View>

            <View style={styles.group}>
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

const styles = StyleSheet.create({
  avatarError: {
    ...typography.body,
    color: colors.brand.primary,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  topSafeArea: {
    backgroundColor: colors.background.surface,
  },
  body: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.sm,
    // Воздух между группами вместо плашек и линеек: по макету профиль — один
    // белый лист, а группы отделяются расстоянием. 32 — замер из макета
    // 882:5541 (следующая группа начинается на 96 при высоте предыдущей 64).
    gap: spacing.xxxl,
  },
  identityGroup: {
    gap: spacing.xxl,
  },
  group: {
    backgroundColor: colors.background.surface,
  },
  // «Выйти из аккаунта» — такая же строка, как остальные, и стоит на том же
  // расстоянии (макет 974:6524: 368 при конце предыдущей группы 336).
  logoutGroup: {
    backgroundColor: colors.background.surface,
  },
});
