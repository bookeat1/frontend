import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../src/components/FlowHeader";
import { PrimaryButton } from "../../../src/components/PrimaryButton";

const t = getDictionary();

/**
 * "Что дальше" — static explanatory copy, no request, therefore no
 * loading/empty/error states: there is nothing here that can fail.
 *
 * Kept as its own route rather than a section on the confirmation screen so
 * the confirmation stays short enough that the booking details are above the
 * fold on a 360x640 device.
 */
export default function WhatsNextScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.booking.whatsNextTitle} onBack={() => router.back()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {t.booking.whatsNextSteps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{index + 1}</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.text}</Text>
            </View>
          </View>
        ))}

        <PrimaryButton label={t.common.close} variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xxl,
  },
  step: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    ...typography.labelSemiBold,
    color: colors.text.onBrand,
  },
  // flex:1 keeps long Russian sentences wrapping inside the column instead of
  // pushing past the right edge at 360px.
  stepText: {
    flex: 1,
    gap: spacing.xs,
  },
  stepTitle: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  stepBody: {
    ...typography.body,
    color: colors.text.muted,
  },
});
