import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useEffect, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSheetAnimation } from "../../lib/sheet-animation";
import { X } from "../icons";
import { WheelPicker, type WheelOption } from "./WheelPicker";

/**
 * Шторка с колесом — «Guests» и «Select Date» из макетов 918:12428 и 918:12317:
 * заголовок с крестиком, колесо значений и одна кнопка «Готово».
 *
 * Выбор здесь ЧЕРНОВОЙ: колесо крутит локальное состояние, и наверх оно уходит
 * только по «Готово». Иначе каждый проворот колеса перезапускал бы поиск, и
 * гость, пролистывающий даты, отправил бы десяток запросов по дороге к нужной.
 * Крестик и тап по затемнению закрывают шторку, ничего не применив.
 */
export function WheelSheet({
  visible,
  title,
  options,
  value,
  submitLabel,
  closeLabel,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: WheelOption[];
  value: string;
  submitLabel: string;
  closeLabel: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { mounted, progress, translateY } = useSheetAnimation(visible);
  const [draft, setDraft] = useState(value);

  // Открыли заново — колесо показывает то, что применено сейчас, а не остаток
  // прошлого, неподтверждённого выбора.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              hitSlop={hitSlop.minTouchTarget / 4}
              onPress={onClose}
            >
              <X size={24} color={colors.text.primary} weight="bold" />
            </Pressable>
          </View>

          <WheelPicker
            options={options}
            value={draft}
            onChange={setDraft}
            accessibilityLabel={title}
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => onSubmit(draft)}
            style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
          >
            <Text style={styles.submitLabel}>{submitLabel}</Text>
          </Pressable>
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
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    ...typography.titleMd,
    color: colors.text.primary,
    flexShrink: 1,
  },
  submit: {
    minHeight: controlHeight.pill,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.primary,
  },
  submitLabel: {
    ...typography.labelMedium,
    color: colors.text.onBrand,
  },
  pressed: {
    opacity: 0.8,
  },
});
