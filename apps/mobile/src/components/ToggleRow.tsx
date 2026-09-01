import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import type { IconProps } from "./icons";

interface ToggleRowProps {
  icon: React.ComponentType<IconProps>;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /**
   * Строка под подписью: что означает текущее положение или почему переключить
   * нельзя. Нужна там, где положение зависит не только от нас (системное
   * разрешение на уведомления), — иначе выключенный тумблер выглядит поломкой.
   */
  description?: string;
  /** Подпись — сообщение об ошибке: красная и объявляется скринридером сразу. */
  descriptionIsError?: boolean;
  /** Переключатель недоступен: настройка ещё читается, идёт запрос или пуши
   * в этой сборке невозможны. */
  disabled?: boolean;
}

/**
 * A settings row whose control is a switch, not a navigation chevron. Mirrors
 * SelectRow's chip layout (leading icon, label, rounded chip background) but
 * swaps the tappable value/chevron for React Native's built-in Switch on the
 * right — the whole row is a real on/off control, not a link to a screen. Used
 * for genuinely stored preferences (e.g. push notifications).
 */
export function ToggleRow({
  icon: Icon,
  label,
  value,
  onValueChange,
  description,
  descriptionIsError = false,
  disabled = false,
}: ToggleRowProps) {
  return (
    <View style={styles.root}>
      <Icon size={24} color={colors.text.primary} weight="regular" />
      {/* A long Russian label ("Уведомления") wraps to two lines rather than
          shoving the switch off a 360px screen. Подпись занимает ту же
          колонку и переносится сколько нужно — на 360px она в две-три строки. */}
      <View style={styles.text}>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
        {description ? (
          <Text
            style={[styles.description, descriptionIsError && styles.descriptionError]}
            accessibilityRole={descriptionIsError ? "alert" : "text"}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        // Скринридеру нужна та же причина, что видит зрячий гость строкой
        // ниже: иначе выключенный переключатель без объяснения.
        accessibilityHint={description}
        accessibilityState={{ disabled }}
        trackColor={{ false: colors.background.secondaryButton, true: colors.brand.primary }}
        thumbColor={colors.background.surface}
        ios_backgroundColor={colors.background.secondaryButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: hitSlop.minTouchTarget + spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // Без подложки: единственная серая плашка на белом листе настроек читалась
    // как выделенная строка, хотя выделять её нечем — она такая же, как
    // соседние (макет 906:10384).
    backgroundColor: colors.background.surface,
  },
  text: {
    // Takes the free space so the switch pins to the right edge.
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  description: {
    ...typography.caption,
    color: colors.text.muted,
  },
  descriptionError: {
    // Единственный красный в палитре — тот же, что у остальных ошибок.
    color: colors.brand.primary,
  },
});
