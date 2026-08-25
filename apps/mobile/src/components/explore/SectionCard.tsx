import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRight } from "../icons";

const t = getDictionary();

/**
 * One white block of the Explore screen. The reference
 * (`design-ref/screen-explore.png`) is a stack of full-width white cards,
 * radius 24 on every corner (Figma 3102:12006 и соседи), separated by 8 of the grey screen background —
 * the same "full-bleed cards on grey" language the booking flow already uses.
 *
 * Horizontal padding lives on the section's own text (16), NOT on the block,
 * because the card strips inside must bleed to the screen edge so the next
 * card can peek.
 */
export function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

/**
 * Section title with the chevron from the reference. The chevron is only a
 * button when there is somewhere to go: `onSeeAll` is optional, and without it
 * the caret renders as plain decoration instead of a control that does nothing
 * when tapped.
 */
export function SectionHeader({
  title,
  onSeeAll,
  showChevron = true,
  size = "compact",
}: {
  title: string;
  onSeeAll?: () => void;
  /** «Выберите кухню» carries no chevron in the design; pass false to drop it.
   * Ignored when `onSeeAll` is set — a navigable header always shows its caret. */
  showChevron?: boolean;
  /**
   * Кегль заголовка. `compact` (17) — главная, где таких заголовков пять
   * подряд и крупные забирали больше места, чем карточки под ними. `large`
   * (20/28) — экран гастрогида, где секция на экране одна и макет
   * (dVjT37j984ErvOmzxlx29p, node 1099:6835) рисует именно 20. Проп добавлен,
   * а не сделан второй компонент: строка «заголовок + шеврон» одна и та же,
   * различие ровно в одном значении.
   */
  size?: "compact" | "large";
}) {
  const caret = <CaretRight size={24} color={colors.text.mutedStrong} weight="regular" />;
  const titleStyle = [styles.title, size === "large" && styles.titleLarge];

  if (!onSeeAll) {
    return (
      <View style={styles.header}>
        <Text style={titleStyle} numberOfLines={2}>
          {title}
        </Text>
        {showChevron ? caret : null}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.sectionSeeAll(title)}
      onPress={onSeeAll}
      style={({ pressed }) => [styles.header, pressed && styles.pressed]}
    >
      {/* Long Russian titles wrap to a second line instead of pushing the
          chevron off a 360-wide screen. */}
      <Text style={titleStyle} numberOfLines={2}>
        {title}
      </Text>
      {caret}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.homeSection,
    paddingVertical: spacing.lg,
    gap: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    // 44pt tall for the touch target, but the title's own line box is 28 — the
    // 8pt of slack on each side is cancelled with negative margins so the
    // block still sits exactly where the reference puts it (title top 16 below
    // the section edge, 24 above the card strip).
    minHeight: hitSlop.minTouchTarget,
    marginVertical: -spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.titleSection,
    color: colors.text.primary,
    flexShrink: 1,
  },
  titleLarge: {
    ...typography.titleLg,
  },
  pressed: {
    opacity: 0.7,
  },
});
