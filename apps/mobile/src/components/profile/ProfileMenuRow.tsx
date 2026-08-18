import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRight, type IconProps } from "../icons";

/**
 * A single horizontal row of the profile menu: leading icon, label, an optional
 * right-aligned current value (city, language), and a chevron.
 *
 * Distinct from `SelectRow` (label OVER value, used inside the reservation
 * flow): here the label and value sit on ONE line the way the profile design
 * draws them, and the value is a muted trailing hint, not the row's subject.
 *
 * A row with no `onPress` is a destination this app does not have yet
 * (track-C): it is drawn NON-interactive with a muted «Скоро» instead of a
 * chevron, rather than a tappable-looking row that leads nowhere — a dead
 * affordance is the same lie as a fake stat. The row stays visible so the menu
 * matches the design and the feature is discoverable.
 */
export function ProfileMenuRow({
  icon: Icon,
  label,
  value,
  onPress,
  comingSoonLabel,
}: {
  icon: React.ComponentType<IconProps>;
  label: string;
  /** Right-aligned current value, e.g. the chosen city or language. */
  value?: string;
  /** Omit for a track-C row with no screen yet — renders non-interactive. */
  onPress?: () => void;
  /** Shown in place of the chevron on a track-C row. */
  comingSoonLabel: string;
}) {
  const content = (
    <>
      <Icon size={24} color={colors.text.primary} weight="regular" />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <CaretRight size={20} color={colors.text.muted} weight="regular" />
      ) : (
        <Text style={styles.comingSoon}>{comingSoonLabel}</Text>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.root} accessibilityRole="text">
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: hitSlop.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    // Замеры из макета 882:5541: иконка 24, подпись начинается на 40 → зазор
    // 16; строка 24 высотой, между строками 16 → по 8 сверху и снизу.
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
    // Takes the free space so the value/chevron pin to the right edge; a long
    // Russian label ("Оценить приложение") clips with an ellipsis rather than
    // shoving the chevron off a 360px screen.
    flex: 1,
  },
  value: {
    ...typography.body,
    color: colors.text.muted,
    // Bounded so the label keeps priority when both are long.
    flexShrink: 1,
    textAlign: "right",
  },
  comingSoon: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
