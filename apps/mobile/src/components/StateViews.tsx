import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "./PrimaryButton";

/**
 * Shared full-bleed state views used across search / restaurant screens
 * whenever a query is loading, empty, or errored — matches the "Загрузка"
 * screen (Figma node 347:4956). NOTE: the mockup's spinner is a custom
 * red/white conic-gradient ring; React Native's platform ActivityIndicator
 * can't reproduce a conic gradient without an extra drawing library, so this
 * uses the native spinner tinted brand red as the closest faithful
 * approximation — flagged in the delivery report.
 *
 * `compact` drops the `flex: 1` so the same three states can be dropped INTO
 * a section of a scrolling screen (the reservation screen's slot list, the
 * pre-order menu) instead of only owning a whole screen. Without it a state
 * view inside a ScrollView collapses to zero height.
 */

interface StateProps {
  compact?: boolean;
}

export function LoadingState({ title, compact }: { title: string } & StateProps) {
  return (
    <View
      style={[styles.center, compact && styles.compact]}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
    >
      <ActivityIndicator size="large" color={colors.brand.primary} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  compact,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
} & StateProps) {
  return (
    <View style={[styles.center, compact && styles.compact]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  compact,
}: {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
} & StateProps) {
  return (
    <View style={[styles.center, compact && styles.compact]} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <PrimaryButton label={retryLabel} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  compact: {
    flex: 0,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.none,
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
  },
});
