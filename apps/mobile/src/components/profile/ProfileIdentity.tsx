import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatStoredPhoneForDisplay } from "../../lib/phone";
import { PhotoView } from "../PhotoView";
import { Camera, UserCircle } from "../icons";

/**
 * The identity block at the top of the «Профиль» vitrina: a brand-red avatar
 * circle carrying the guest's initials, their name and phone below it.
 *
 * Тап по аватару меняет ФОТОГРАФИЮ (макет 979:7754), а не открывает форму
 * редактирования: значок камеры на круге обещает именно это, и увести человека
 * на другой экран после такого обещания — обмануть его. The name and phone below are plain, static
 * text: tapping them does nothing. (Previously the whole block was one
 * Pressable, so a tap on the name unexpectedly opened editing — Damir flagged
 * that 2026-08-06.) The avatar is a real button: keyboard-reachable and
 * labelled, not a bare Pressable.
 *
 * Инициалы — запасной вариант, когда фотографии нет: они выводятся из имени и
 * нигде не хранятся. Гость без имени получает нейтральный значок, а не
 * выдуманные буквы из номера телефона.
 *
 * Пока фотография загружается, круг показывает индикатор и не принимает
 * нажатий: второй тап по дороге отправил бы второй файл, и какой из них
 * победит, решала бы гонка.
 */
export function ProfileIdentity({
  name,
  phone,
  avatarUrl,
  editLabel,
  namePlaceholder,
  uploading = false,
  onPress,
}: {
  name: string;
  phone: string | null;
  /** Фотография профиля; null — рисуем инициалы. */
  avatarUrl?: string | null;
  /** Accessibility label for the tap target (it changes the photo). */
  editLabel: string;
  /** Shown in place of the name when the account has none yet. */
  namePlaceholder: string;
  /** Фото уже отправляется — круг занят и не принимает нажатий. */
  uploading?: boolean;
  onPress: () => void;
}) {
  const initials = deriveInitials(name);
  const displayName = name.trim().length > 0 ? name : namePlaceholder;

  return (
    <View style={styles.root}>
      {/* Only the avatar opens editing — the name/phone below are static text. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={editLabel}
        accessibilityState={{ busy: uploading, disabled: uploading }}
        disabled={uploading}
        onPress={onPress}
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
      >
        {avatarUrl ? (
          <PhotoView uri={avatarUrl} style={styles.photo} decorative placeholderIconSize={40} />
        ) : initials ? (
          <Text style={styles.initials} accessibilityElementsHidden importantForAccessibility="no">
            {initials}
          </Text>
        ) : (
          // No name to build initials from — a neutral figure, not invented letters.
          <UserCircle size={56} color={colors.text.onBrand} weight="regular" />
        )}

        {uploading ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.text.onBrand} />
          </View>
        ) : (
          <View style={styles.camera} accessibilityElementsHidden importantForAccessibility="no">
            <Camera size={18} color={colors.text.onBrand} weight="fill" />
          </View>
        )}
      </Pressable>
      <Text style={styles.name} numberOfLines={2}>
        {displayName}
      </Text>
      {phone ? (
        <Text style={styles.phone} numberOfLines={1}>
          {formatStoredPhoneForDisplay(phone)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * First letters of the first two words of the name, uppercased ("Шакен Шаку" →
 * "ШШ", "Айгүл" → "А"). Returns null when there is nothing to build from, which
 * is the caller's cue to draw the fallback glyph.
 */
function deriveInitials(name: string): string | null {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const letters = words.slice(0, 2).map((word) => word[0]);
  return letters.join("").toUpperCase();
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 96,
    height: 96,
    overflow: "visible",
    borderRadius: 48,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    // Keeps the tap target comfortably above the 44pt floor on its own.
    minHeight: hitSlop.minTouchTarget,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  // Значок камеры сидит на краю круга, как в макете: он и подсказывает, что
  // круг нажимается, и говорит, ЧТО именно произойдёт.
  camera: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text.primary,
    borderWidth: 2,
    borderColor: colors.background.surface,
  },
  busy: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay.scrim,
  },
  initials: {
    ...typography.titleLg,
    fontSize: 32,
    lineHeight: 40,
    color: colors.text.onBrand,
  },
  name: {
    ...typography.titleLg,
    color: colors.text.primary,
    textAlign: "center",
  },
  phone: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: "center",
  },
});
