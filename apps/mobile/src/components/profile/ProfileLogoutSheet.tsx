import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../PrimaryButton";

/**
 * The «Выйти из аккаунта» confirmation — a bottom sheet, same mechanics as the
 * search FilterSheet (bottom Modal, dimmed backdrop, rounded top), kept
 * self-contained here so the profile screen owns nothing about how it is drawn.
 *
 * Signing out is not destructive, but it is a mode switch a stray tap should
 * not trigger, so it is confirmed rather than done inline. The confirm button
 * is disabled while the sign-out is in flight — a second tap must not start a
 * second SecureStore write (the screen guards this too; the two agree).
 */
export function ProfileLogoutSheet({
  visible,
  signingOut,
  title,
  confirmLabel,
  confirmBusyLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  signingOut: boolean;
  title: string;
  confirmLabel: string;
  /** Shown on the confirm button while the sign-out is running. */
  confirmBusyLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.root}>
        {/* Tap-to-dismiss backdrop — hidden from the screen reader so focus
            lands on the sheet, not an unnamed full-screen button. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          accessibilityViewIsModal
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <PrimaryButton
            label={signingOut ? confirmBusyLabel : confirmLabel}
            size="lg"
            onPress={onConfirm}
            disabled={signingOut}
          />
          <PrimaryButton
            label={cancelLabel}
            variant="secondary"
            size="lg"
            onPress={onCancel}
            disabled={signingOut}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay.dialogScrim,
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.titleMd,
    color: colors.text.primary,
    textAlign: "center",
    paddingBottom: spacing.sm,
  },
});
