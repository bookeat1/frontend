import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSheetAnimation } from "../lib/sheet-animation";

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
 *
 * Появление анимируется вручную, а не системным `animationType="slide"`:
 * системная анимация выезжает рывком и не гасит фон, из-за чего шторка
 * читалась как подмена экрана, а не как слой поверх него. Здесь панель
 * выезжает с торможением, а затемнение набирается одновременно с ней.
 *
 * Нижний отступ считается по безопасной зоне: без него кнопка «отмена»
 * упиралась в системную полосу и на части телефонов оказывалась наполовину за
 * краем — то есть человек видел действие, но не мог до него дотянуться.
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
  const insets = useSafeAreaInsets();
  const { mounted, progress, translateY } = useSheetAnimation(visible);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={pending ? () => {} : onCancel}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={pending ? undefined : onCancel}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            // Кнопки не должны прятаться под системной полосой снизу.
            { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
          ]}
          accessibilityViewIsModal
        >
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
        </Animated.View>
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
