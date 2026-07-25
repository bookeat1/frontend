import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../PrimaryButton";

const t = getDictionary();

/**
 * "Отменить бронь?" — the confirmation the guest must pass before anything is
 * sent. The third frame of the design (488:10462) could not be exported, so
 * this is built in the same visual language as the rest of the flow: a white
 * card with `radius.dialog` corners over a dark scrim, `titleCard` heading,
 * body copy, then the two 48pt pill buttons the flow already uses — the
 * destructive one is NOT the visually dominant button, and the safe choice
 * ("Оставить бронь") is the one that reads as primary.
 *
 * `consequence` is the money sentence (see cancellation-cost.ts). It is
 * always shown, never hidden behind a "details" link: it is the single fact
 * the guest needs to make this decision.
 *
 * While the request is in flight the confirm button is disabled and relabelled
 * — one of the two guards against a double tap; the other is in the mutation
 * itself (see useCancelBooking).
 */
export function CancelBookingDialog({
  visible,
  consequence,
  pending,
  error,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  consequence: string;
  pending: boolean;
  /** Already-translated Russian message, or null. Rendered inside the dialog
   * so the guest sees the failure right where they acted. */
  error: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  // Android's hardware back and a tap on the scrim both mean "no" — but only
  // while nothing is in flight, otherwise the guest could dismiss the dialog
  // and lose sight of a cancel that is still happening.
  const dismiss = () => {
    if (!pending) onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        {/* Backdrop. It is only a tap target — hidden from the accessibility
            tree so a screen reader lands on the dialog, not on a nameless
            full-screen button. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        {/* accessibilityViewIsModal traps VoiceOver inside the dialog on iOS,
            which is the whole point of a confirmation. */}
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {t.booking.cancelDialogTitle}
          </Text>
          <Text style={styles.body}>{consequence}</Text>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton
              label={t.booking.cancelKeep}
              size="lg"
              onPress={onDismiss}
              disabled={pending}
            />
            <PrimaryButton
              label={pending ? t.booking.cancelling : t.booking.cancelConfirm}
              variant="secondary"
              size="lg"
              onPress={onConfirm}
              disabled={pending}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.overlay.dialogScrim,
    justifyContent: "center",
    padding: spacing.xxl,
  },
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.dialog,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.titleCard,
    color: colors.text.primary,
  },
  body: {
    ...typography.body,
    color: colors.text.mutedStrong,
  },
  error: {
    ...typography.body,
    color: colors.status.negativeText,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
