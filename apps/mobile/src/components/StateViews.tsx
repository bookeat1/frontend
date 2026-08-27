import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { IconProps } from "./icons";
import { PrimaryButton } from "./PrimaryButton";

/** Diameter of the circular icon container from the Figma «Состояния» template
 * (node 997:10239). Kept as one constant so the radius stays exactly half of
 * it — the container must always render as a perfect circle, never a squircle. */
const ICON_CONTAINER_SIZE = 64;

/**
 * Shared empty / error / loading state views.
 *
 * The empty and error states are ONE template, taken 1:1 from the Figma
 * «Состояния» section (file 7rBjjTjp4FbxV9SCJmypWF, node 997:10239): an icon in
 * a 64×64 rounded square, a title, a description, and an optional action —
 * either a red text-link or a filled red button — centred in the content area.
 * `EmptyState` and `ErrorState` are the same markup; they differ only in the
 * accessibility role (`ErrorState` announces as an alert) so a screen reader
 * treats a failure differently from an ordinary "nothing here yet".
 *
 * Отступы и заливка кружка сняты с макета 3z0f6dgev4HMwBAHPjTjPo (узлы
 * 1033:15574 «Броней нет» и 1033:15798 «Броней нет история» — один и тот же
 * шаблон): поля 16 по краям, кружок 64 с заливкой #F5F5F5, 24 до заголовка,
 * 12 между заголовком и описанием, 24 до кнопки, кнопка высотой 48.
 *
 * NOTE: тон самого глифа в макете переменной не задан — он остаётся на
 * `text.mutedStrong`, палитре остальных заглушек приложения.
 *
 * `compact` drops the `flex: 1` so the same template can be dropped INTO a
 * section of a scrolling screen (the Home «Афиша»/«Выбрали для вас» rails)
 * instead of only owning a whole screen. Without it a state view inside a
 * ScrollView collapses to zero height.
 */

export type StateActionVariant = "link" | "button";

export interface StateAction {
  label: string;
  onPress: () => void;
  /** `button` — a filled red CTA (e.g. «Найти ресторан»); `link` — a red
   * text-link (e.g. «Написать в поддержку», «Сбросить фильтры»). */
  variant: StateActionVariant;
}

interface StateProps {
  compact?: boolean;
}

interface StateViewProps extends StateProps {
  /**
   * The 64×64 glyph. Optional: the states covered by the Figma «Состояния»
   * section always pass their exact icon, but many older detail/booking/profile
   * states have no icon in the design yet — those omit it and render just the
   * title/description/action rather than showing a fabricated glyph. Add the
   * icon here once the design covers the state.
   */
  icon?: React.ComponentType<IconProps>;
  title: string;
  description: string;
  action?: StateAction;
  /** `alert` for a failure, `none` for an ordinary empty state. */
  accessibilityRole?: "alert" | "none";
}

export function LoadingState({ title, compact }: { title: string } & StateProps) {
  return (
    <View
      style={[styles.center, compact && styles.compact]}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
    >
      <ActivityIndicator size="large" color={colors.brand.primary} />
      <Text style={styles.loadingTitle}>{title}</Text>
    </View>
  );
}

/** The shared empty/error template. Prefer `EmptyState`/`ErrorState`, which
 * pin the correct accessibility role for you. */
export function StateView({
  icon: Icon,
  title,
  description,
  action,
  compact,
  accessibilityRole = "none",
}: StateViewProps) {
  return (
    <View
      style={[styles.center, compact && styles.compact]}
      accessibilityRole={accessibilityRole === "alert" ? "alert" : undefined}
    >
      {Icon ? (
        <View style={styles.iconContainer}>
          <Icon size={32} color={colors.text.mutedStrong} weight="regular" />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? (
        action.variant === "button" ? (
          <View style={styles.action}>
            {/* 48 высотой — как «Найти ресторан» в макете (node 1033:15581). */}
            <PrimaryButton label={action.label} onPress={action.onPress} size="lg" />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
          >
            <Text style={styles.linkLabel}>{action.label}</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

export function EmptyState(props: Omit<StateViewProps, "accessibilityRole">) {
  return <StateView {...props} accessibilityRole="none" />;
}

export function ErrorState(props: Omit<StateViewProps, "accessibilityRole">) {
  return <StateView {...props} accessibilityRole="alert" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  compact: {
    flex: 0,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.none,
  },
  iconContainer: {
    width: ICON_CONTAINER_SIZE,
    height: ICON_CONTAINER_SIZE,
    // A perfect circle (Figma «Состояния»: light-grey circle, grey glyph
    // centred), so the radius is always half the size — not a rounded square.
    borderRadius: ICON_CONTAINER_SIZE / 2,
    // #F5F5F5 из макета — тот же тон, что и `background.screen`,
    // а не чиповый #F1F1F1, который стоял здесь раньше.
    backgroundColor: colors.background.screen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.titleMd,
    color: colors.text.primary,
    textAlign: "center",
  },
  description: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: spacing.md,
  },
  // The loading state keeps the pre-template spacing (spinner over a caption).
  loadingTitle: {
    ...typography.titleMd,
    color: colors.text.primary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  action: {
    marginTop: spacing.xxl,
  },
  link: {
    marginTop: spacing.xl,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkLabel: {
    ...typography.labelSemiBold,
    color: colors.brand.primary,
    textAlign: "center",
  },
});
