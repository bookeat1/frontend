import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

/**
 * The white full-bleed card the Reservation detail screen is built from
 * (Figma node 488:9876). Same stacking rule the rest of the booking flow
 * already follows: cards run edge to edge, are separated by 8 of grey screen
 * background, and only the OUTER corners of the stack are rounded.
 *
 * `corners="bottom"` is the header card (flush with the top bar);
 * `corners="all"` is every card in the middle of the stack.
 */
export function BookingCard({
  title,
  corners = "all",
  align = "start",
  /**
   * `card` (по умолчанию) — прежний заголовок 18/26 (`typography.titleCard`).
   * `section` — 20/28 −0.5 (`typography.titleLg`), которым в редизайне
   * (Figma «BookEat (Copy) (Copy)», узлы 5504:7533/7536/7567/7594) нарисованы
   * «What happens next?», «Pre-order», «Contacts», «Want to cancel?».
   * Проп, а не смена дефолта: `BookingCard` делит вёрстку с `profile/edit.tsx`,
   * и молчаливая правка заголовка задела бы экран, которого эта задача не
   * касается.
   */
  titleSize = "card",
  /** Просвет между заголовком и содержимым. По умолчанию — прежние 12
   * (`spacing.md`), не занятые этой правкой: то же самое про `profile/edit.tsx`. */
  gap = spacing.md,
  style,
  children,
}: {
  title?: string;
  corners?: "all" | "bottom";
  align?: "start" | "center";
  titleSize?: "card" | "section";
  gap?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        corners === "bottom" ? styles.cornersBottom : styles.cornersAll,
        align === "center" && styles.centered,
        { gap },
        style,
      ]}
    >
      {title ? (
        <Text
          style={[styles.title, titleSize === "section" && styles.titleSection]}
          accessibilityRole="header"
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    // Раньше карточки разделял серый фон экрана. Фон стал белым, и без
    // тонкой рамки две брони подряд читались бы как одна длинная запись —
    // граница здесь несёт тот же смысл, что раньше нёс просвет.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.control,
    padding: spacing.lg,
  },
  cornersAll: {
    borderRadius: radius.card,
  },
  cornersBottom: {
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  centered: {
    alignItems: "center",
  },
  title: {
    ...typography.titleCard,
    color: colors.text.primary,
  },
  titleSection: {
    ...typography.titleLg,
  },
});
