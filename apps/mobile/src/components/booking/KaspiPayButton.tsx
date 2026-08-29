import { controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { KASPI_BRAND_COLOR } from "../../lib/kaspi-payment";

/**
 * Кнопка «оплатить через Kaspi».
 *
 * # Про товарный знак — читать перед тем, как что-то здесь менять
 *
 * ОФИЦИАЛЬНОГО АССЕТА KASPI ЗДЕСЬ НЕТ. В репозитории нет ни файла с логотипом,
 * ни лицензии на него, и в ходе этой задачи ничего с сайта Kaspi не
 * скачивалось: чужой знак нельзя класть в сборку «на всякий случай». Поэтому
 * кнопка нарисована сама: наша пилюля, наша типографика, подпись словами.
 *
 * Единственное, что взято у Kaspi, — узнаваемый красный `#F14635`
 * (`KASPI_BRAND_COLOR`). Это тоже элемент фирменного стиля, и до письменного
 * подтверждения от Kaspi использование считается НЕсогласованным. Если права
 * не подтвердят — достаточно поменять `KASPI_BRAND_COLOR` на наш собственный
 * `colors.brand.primary`, и кнопка станет полностью нейтральной; ни один
 * другой файл трогать не придётся.
 *
 * Отдельный компонент, а не `PrimaryButton` с чужим цветом: фирменный цвет
 * партнёра не должен просачиваться в общий примитив приложения — иначе завтра
 * его начнут передавать откуда попало.
 */
export function KaspiPayButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Счёт создаётся: спиннер вместо подписи, нажатие не проходит. */
  busy?: boolean;
  accessibilityHint?: string;
}) {
  const blocked = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        blocked && styles.disabled,
        pressed && !blocked && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hitSlop.minTouchTarget,
    height: controlHeight.pill,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    backgroundColor: KASPI_BRAND_COLOR,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.labelSemiBold,
    color: "#FFFFFF",
  },
});
