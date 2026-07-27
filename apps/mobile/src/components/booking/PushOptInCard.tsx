import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePush } from "../../lib/push";
import { PrimaryButton } from "../PrimaryButton";
import { BookingCard } from "./BookingCard";

const t = getDictionary();

/**
 * The one place this app asks for notification permission.
 *
 * It appears on the reservation screen, and ONLY for a booking the guest has
 * just created (`created=1`, set by the reservation flow's `router.replace`).
 * Rationale in push.tsx: the ask has to arrive when the guest already wants
 * the answer, and on iOS it can only be made once.
 *
 * Four states, and all four are ends of the road — the card never nags:
 *   ask     — the soft prompt, before any system dialog
 *   enabled — a confirmation, so the tap has a visible result
 *   denied  — the system said no; says where it is fixed, offers no retry
 *             (a second `requestPermissionsAsync` on iOS shows nothing)
 *   failed  — network / provider; offers exactly one retry
 *
 * It renders nothing at all when push is unsupported (web, simulator, Expo Go
 * on Android, no EAS project id) or when permission has already been answered
 * — an unsupported runtime shows the guest no card and no error.
 */
type CardState = "checking" | "hidden" | "ask" | "working" | "enabled" | "denied" | "failed";

export function PushOptInCard() {
  const push = usePush();
  const [state, setState] = React.useState<CardState>("checking");

  React.useEffect(() => {
    if (!push.supported) {
      setState("hidden");
      return;
    }
    let cancelled = false;
    void push.permission().then((permission) => {
      if (cancelled) return;
      // Already granted: nothing to ask, and a "notifications are on" card on
      // every new booking would be noise. Already denied: the system dialog
      // is spent, so the card would be a button that does nothing.
      setState(permission === "undetermined" ? "ask" : "hidden");
    });
    return () => {
      cancelled = true;
    };
  }, [push]);

  const onEnable = () => {
    // Double-tap is harmless by construction (the registrar serialises calls),
    // but the button is disabled anyway so the guest sees that it took.
    if (state === "working") return;
    setState("working");
    void push.enable().then((outcome) => {
      switch (outcome.state) {
        case "registered":
        case "unchanged":
          setState("enabled");
          return;
        case "denied":
          setState("denied");
          return;
        case "permission-undetermined":
          // The dialog was dismissed without an answer (possible on Android).
          // Back to the ask — the guest can still decide.
          setState("ask");
          return;
        case "unsupported":
          setState("hidden");
          return;
        // "no-token" and "failed" are both "we could not finish", and the
        // guest can do the same thing about either one: try again.
        default:
          setState("failed");
      }
    });
  };

  if (state === "checking" || state === "hidden") return null;

  if (state === "enabled") {
    return (
      <BookingCard title={t.push.enabledTitle}>
        <Text style={styles.body}>{t.push.enabledDescription}</Text>
      </BookingCard>
    );
  }

  if (state === "denied") {
    return (
      <BookingCard title={t.push.deniedTitle}>
        <Text style={styles.body}>{t.push.deniedDescription}</Text>
      </BookingCard>
    );
  }

  return (
    <BookingCard title={t.push.optInTitle}>
      <Text style={styles.body}>
        {state === "failed" ? t.push.failedDescription : t.push.optInDescription}
      </Text>
      {state === "failed" ? (
        <Text style={styles.error} accessibilityRole="alert">
          {t.push.failedTitle}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          label={t.push.optInEnable}
          onPress={onEnable}
          disabled={state === "working"}
        />
        <PrimaryButton
          label={t.push.optInDismiss}
          variant="secondary"
          onPress={() => setState("hidden")}
          disabled={state === "working"}
        />
      </View>
    </BookingCard>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.text.mutedStrong,
  },
  error: {
    ...typography.body,
    // The brand red is the only red in the palette; there is no `text.danger`
    // token and inventing one for a single line would be a second red.
    color: colors.brand.primary,
  },
  actions: {
    gap: spacing.sm,
  },
});
