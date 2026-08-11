import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Нижняя шторка подтверждения (макет профиля, nodes 976:6787 и 985:8120):
 * заголовок, объяснение и две кнопки в столбик — действие и отмена.
 *
 * Именно шторка, а не отдельный экран: решение принимается там же, где стоит
 * пункт меню, и отказ возвращает гостя ровно туда, откуда он пришёл, без
 * перехода назад по стеку.
 *
 * Опасное действие (`destructive`) красит кнопку в фирменный красный. Пока
 * запрос в полёте, обе кнопки заблокированы: закрыть шторку на середине
 * удаления — верный способ не узнать, чем оно кончилось.
 */
export function ConfirmSheet({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  /** Запрос в полёте: кнопка показывает свой «…» текст и не принимает нажатий. */
  pending?: boolean;
  /** Строка ошибки под кнопками — шторка остаётся открытой, чтобы повторить. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={pending ? () => {} : onCancel}
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={pending ? undefined : onCancel}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />

        <SafeAreaView edges={["bottom"]} style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.text}>
            <Text style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                destructive ? styles.buttonDestructive : styles.buttonPrimary,
                pressed && styles.pressed,
                pending && styles.disabled,
              ]}
            >
              <Text style={styles.buttonLabelOnFill}>{confirmLabel}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                pressed && styles.pressed,
                pending && styles.disabled,
              ]}
            >
              <Text style={styles.buttonLabel}>{cancelLabel}</Text>
            </Pressable>
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: colors.overlay.dialogScrim,
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  text: {
    gap: spacing.md,
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  description: {
    ...typography.body,
    color: colors.text.muted,
  },
  actions: {
    gap: spacing.sm,
  },
  button: {
    height: controlHeight.pill,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: colors.brand.primary,
  },
  buttonDestructive: {
    backgroundColor: colors.brand.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.background.secondaryButton,
  },
  buttonLabel: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  buttonLabelOnFill: {
    ...typography.labelSemiBold,
    color: colors.text.onBrand,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    ...typography.caption,
    color: colors.brand.primary,
    marginBottom: spacing.sm,
  },
});
