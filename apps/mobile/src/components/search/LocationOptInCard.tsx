import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "../../lib/locale";
import { BookingCard } from "../booking/BookingCard";
import { PrimaryButton } from "../PrimaryButton";

/**
 * Пре-промпт «Показать сначала ближайшие?» — только отрисовка. Вся логика
 * (когда показывать, флаги, системный диалог) в `useLocationPrompt`, потому что
 * решение должно жить дольше, чем эта карточка на экране.
 *
 * Вид и токены — как у `PushOptInCard`: макета у геопозиции нет (в выгрузках
 * Figma экрана нет), второй стиль заводить незачем. Появится макет — берём его.
 */
export function LocationOptInCard({
  working,
  onAllow,
  onLater,
}: {
  working: boolean;
  onAllow: () => void;
  onLater: () => void;
}) {
  const { dictionary: t } = useLocale();
  return (
    <View style={styles.wrap}>
      <BookingCard title={t.location.promptTitle}>
        <Text style={styles.body}>{t.location.promptBody}</Text>
        <View style={styles.actions}>
          <PrimaryButton label={t.location.allow} onPress={onAllow} disabled={working} />
          <PrimaryButton
            label={t.location.notNow}
            variant="secondary"
            onPress={onLater}
            disabled={working}
          />
        </View>
      </BookingCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.text.mutedStrong,
  },
  actions: {
    gap: spacing.sm,
  },
});
