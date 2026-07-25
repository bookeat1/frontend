import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../../src/components/FlowHeader";
import { MonthCalendar } from "../../../../src/components/MonthCalendar";
import { useBookingDraft } from "../../../../src/lib/booking-draft";

const t = getDictionary();

/**
 * "Выберите дату". Picking a day writes it to the draft and pops straight back
 * — no separate "Применить" button, because there is exactly one decision on
 * this screen and a confirm step would only add a tap.
 *
 * No async data here, so no loading/error state to render: the bookable range
 * is the venue policy's horizon, which is a constant, not a request.
 */
export default function SelectDateScreen() {
  const router = useRouter();
  const draft = useBookingDraft();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.booking.pickDateTitle} onBack={() => router.back()} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MonthCalendar
          selected={draft.date}
          maxDate={draft.maxDate}
          onSelect={(dateKey) => {
            draft.setDate(dateKey);
            router.back();
          }}
        />
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
  },
});
