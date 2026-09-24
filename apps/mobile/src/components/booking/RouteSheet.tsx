import { colors, radius, spacing } from "@bookeat/design-tokens";
import React from "react";
import { Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSheetAnimation } from "../../lib/sheet-animation";

/**
 * Нижняя шторка, которая живёт как МАРШРУТ (`presentation: "transparentModal"`
 * в `app/_layout.tsx`): предыдущий экран остаётся виден под затемнением, как в
 * макетах оплаты предзаказа (Figma qmMsg4jO1ggmyEHNIAD2ll, 5387:7782 /
 * 5390:8698 / 5390:9142). Маршрутом, а не `<Modal>` как `ConfirmSheet`, потому
 * что шторка «Оплата» переходит в «Успех»/«Ошибку» через `router.replace`, а
 * у них свой deep link и своя история.
 *
 * Полоска-ручка и тап по затемнению закрывают шторку (`onClose`). Панель не
 * выше 90% окна: контент внутри скроллится, а `footer` (главная кнопка)
 * прибит к низу и не уезжает.
 */
export function RouteSheet({
  onClose,
  children,
  footer,
  closeLabel,
}: {
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Подпись для скринридера у затемнения-«закрыть». */
  closeLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { progress, translateY } = useSheetAnimation(true, Math.max(height, 640));

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { maxHeight: height * 0.9, paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
        ]}
        accessibilityViewIsModal
      >
        <Pressable onPress={onClose} accessibilityElementsHidden importantForAccessibility="no" style={styles.handleHit}>
          <View style={styles.handle} />
        </Pressable>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: colors.overlay.dialogScrim },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
  },
  handleHit: { alignItems: "center", paddingVertical: spacing.md },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.background.secondaryButton },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
});
