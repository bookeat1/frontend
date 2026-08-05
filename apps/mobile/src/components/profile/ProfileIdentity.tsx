import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatStoredPhoneForDisplay } from "../../lib/phone";
import { UserCircle } from "../icons";

/**
 * The identity block at the top of the «Профиль» vitrina: a brand-red avatar
 * circle carrying the guest's initials, their name and phone below it.
 *
 * The whole block is the entry point to editing — there is no edit form on the
 * vitrina itself, so tapping here is how a guest changes their name/city/birth
 * date (see app/profile/edit.tsx). It is a real button: keyboard-reachable and
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={editLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        {initials ? (
          <Text style={styles.initials} accessibilityElementsHidden importantForAccessibility="no">
            {initials}
          </Text>
        ) : (
          // No name to build initials from — a neutral figure, not invented letters.
          <UserCircle size={56} color={colors.text.onBrand} weight="regular" />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {displayName}
      </Text>
      {phone ? (
        <Text style={styles.phone} numberOfLines={1}>
          {formatStoredPhoneForDisplay(phone)}
        </Text>
      ) : null}
    </Pressable>
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
