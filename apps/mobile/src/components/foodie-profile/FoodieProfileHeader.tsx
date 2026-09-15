import { colors, foodieProfileLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlowHeader } from "../FlowHeader";

export const FOODIE_PROFILE_STEPS = 4;

// Заголовок «Фуди-профиль» общий на все четыре шага и не завязан на пропы
// экрана, поэтому взят словарём модуля, как остальные статические подписи
// компонентов этого приложения (см. FlowHeader.tsx — тот же приём).
const t = getDictionary().onboarding.foodieProfile;

/**
 * Общая шапка всех четырёх шагов визарда «Фуди-профиль» (Figma
 * qmMsg4jO1ggmyEHNIAD2ll, узлы 5161:11573 / 5062:5734 / 5062:5841 /
 * 5161:11786 — значения переданы координатором из DesignAgent bridge).
 *
 * Стрелка назад + заголовок «Фуди-профиль» — это `FlowHeader`, у которого уже
 * есть слот `trailing` (тот же, которым пользуется «Очистить» на экране
 * пре-ордера) — под него и легла ссылка «Далее»/«Готово», без правки самого
 * компонента. Пагинация — ОТДЕЛЬНЫЙ ряд под шапкой, потому что `FlowHeader`
 * везде в приложении ровно 56pt и без второй строки; дублировать его целиком
 * ради одной новой полоски было бы вторым «почти тем же» хедером.
 */
export function FoodieProfileHeader({
  onBack,
  step,
  nextLabel,
  nextEnabled,
  onNext,
}: {
  onBack: () => void;
  /** 1-based, 1..FOODIE_PROFILE_STEPS. */
  step: number;
  nextLabel: string;
  nextEnabled: boolean;
  onNext: () => void;
}) {
  return (
    <View>
      <FlowHeader
        title={t.headerTitle}
        onBack={onBack}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            accessibilityState={{ disabled: !nextEnabled }}
            disabled={!nextEnabled}
            onPress={onNext}
            style={styles.nextButton}
          >
            <Text style={[styles.nextLabel, !nextEnabled && styles.nextLabelDisabled]}>
              {nextLabel}
            </Text>
          </Pressable>
        }
      />
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: FOODIE_PROFILE_STEPS }, (_, index) => {
          const position = index + 1;
          const isCurrent = position === step;
          const isDone = position < step;
          return (
            <View
              key={position}
              style={[
                styles.dot,
                isCurrent && styles.dotCurrent,
                (isCurrent || isDone) && styles.dotFilled,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nextButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  nextLabel: {
    ...typography.labelSemiBold,
    color: colors.brand.primary,
  },
  nextLabelDisabled: {
    color: colors.text.navInactive,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: foodieProfileLayout.stepDotGap,
    paddingBottom: spacing.md,
  },
  dot: {
    width: foodieProfileLayout.stepDotHeight,
    height: foodieProfileLayout.stepDotHeight,
    borderRadius: radius.progressDot,
    backgroundColor: colors.onboarding.stepDotInactive,
  },
  dotFilled: {
    backgroundColor: colors.brand.primary,
  },
  dotCurrent: {
    width: foodieProfileLayout.stepDotActiveWidth,
  },
});
