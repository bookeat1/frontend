import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatStoredPhoneForDisplay } from "../../lib/phone";
import { UserCircle } from "../icons";

/**
 * The identity block at the top of the «Профиль» vitrina: a brand-red avatar
 * circle carrying the guest's initials, their name and phone below it.
 *
 * Only the AVATAR is the edit entry point — tapping the avatar opens the edit
 * screen (app/profile/edit.tsx). The name and phone below are plain, static
 * text: tapping them does nothing. (Previously the whole block was one
 * Pressable, so a tap on the name unexpectedly opened editing — Damir flagged
 * that 2026-08-06.) The avatar is a real button: keyboard-reachable and
 * labelled, not a bare Pressable.
 *
 * Initials are derived, never stored: the account has no avatar upload (see
 * ProfileUpdate), so the circle is text. A guest who never filled in a name
 * gets a neutral glyph rather than an empty or guessed circle — inventing
 * letters from a phone number would be a lie the same way a fake stat is.
 */
export function ProfileIdentity({
  name,
  phone,
  editLabel,
  namePlaceholder,
  onPress,
}: {
  name: string;
  phone: string | null;
  /** Accessibility label for the whole tap target (it opens the edit screen). */
  editLabel: string;
  /** Shown in place of the name when the account has none yet. */
  namePlaceholder: string;
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
        onPress={onPress}
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
      >
        {initials ? (
          <Text style={styles.initials} accessibilityElementsHidden importantForAccessibility="no">
            {initials}
          </Text>
        ) : (
          // No name to build initials from — a neutral figure, not invented letters.
          <UserCircle size={56} color={colors.text.onBrand} weight="regular" />
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
    borderRadius: 48,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    // Keeps the tap target comfortably above the 44pt floor on its own.
    minHeight: hitSlop.minTouchTarget,
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
