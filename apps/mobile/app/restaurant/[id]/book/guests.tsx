import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../../src/components/FlowHeader";
import { PrimaryButton } from "../../../../src/components/PrimaryButton";
import { Stepper } from "../../../../src/components/Stepper";
import { MAX_GUESTS, MIN_GUESTS, useBookingDraft } from "../../../../src/lib/booking-draft";

const t = getDictionary();

/** Shortcut chips for the party sizes people actually book. Anything else goes
 * through the stepper. */
const QUICK_PICKS = [1, 2, 3, 4, 5, 6, 8, 10];

/**
 * "Сколько гостей". Changing the party size clears the chosen time slot (see
 * BookingDraftProvider.setGuests) because availability is computed per party —
 * a table that seated 2 may not seat 8.
 */
export default function GuestsScreen() {
  const router = useRouter();
  const draft = useBookingDraft();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.booking.pickGuestsTitle} onBack={() => router.back()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepperCard}>
          <Stepper
            value={draft.guests}
            min={MIN_GUESTS}
            max={MAX_GUESTS}
            onChange={draft.setGuests}
            valueLabel={t.booking.guestsCount(draft.guests)}
            decreaseLabel={t.booking.guestsDecrease}
            increaseLabel={t.booking.guestsIncrease}
          />
        </View>

        <View style={styles.chips}>
          {QUICK_PICKS.map((count) => {
            const active = count === draft.guests;
            return (
              <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.booking.guestsCount(count)}
                onPress={() => draft.setGuests(count)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && !active && styles.pressed,
                ]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* The cap is the platform default (BOOKING_DEFAULT_MAX_GUESTS = 20);
            a venue can set a lower one, but that policy is staff-only, so the
            honest thing is to say where the app's own limit is and let the
            server refuse the rest with its own message. */}
        <Text style={styles.hint}>{t.booking.guestsHint(MAX_GUESTS)}</Text>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
        <View style={styles.footer}>
          <PrimaryButton size="lg" label={t.booking.preorderDone} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
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
  content: {
    padding: spacing.lg,
    gap: spacing.xxl,
  },
  stepperCard: {
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.background.surface,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    minWidth: 56,
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.chip,
    paddingHorizontal: spacing.md,
  },
  chipActive: {
    backgroundColor: colors.brand.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  chipLabel: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  chipLabelActive: {
    color: colors.text.onBrand,
  },
  hint: {
    ...typography.caption,
    color: colors.text.muted,
  },
  footerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  footer: {
    padding: spacing.md,
  },
});
