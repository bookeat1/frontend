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
