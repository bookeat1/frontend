import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "./PrimaryButton";

/**
 * Shared full-bleed state views used across search / restaurant screens
 * whenever a query is loading, empty, or errored. Styled to match the
 * "Загрузка" screen from the design spec (centered icon/spinner + caption).
 */

export function LoadingState({ title }: { title: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={title}>
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
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
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
}: {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.center} accessibilityRole="alert">
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
  title: {
    ...typography.h3,
    color: colors.neutral[900],
    textAlign: "center",
  },
  description: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: "center",
  },
});
