import type { Booking } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../src/components/FlowHeader";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { TimeSlotGrid } from "../../../src/components/TimeSlotGrid";
import { WheelSheet } from "../../../src/components/search/WheelSheet";
import { useRepository } from "../../../src/lib/repository";
import { guestOptions } from "../../../src/lib/availability-options";
import { formatRelativeDay, formatTime, toDateKey } from "../../../src/lib/format";
import { useLocale } from "../../../src/lib/locale";

/**
 * Перенос существующей брони: другое время того же дня или другое число гостей.
 *
 * Экран НЕ создаёт новую бронь и не отменяет старую. У брони есть история,
 * подтверждение заведения и уведомления, и пересоздание всё это обнулило бы —
 * поэтому здесь ровно один вызов: `PATCH /bookings/:id`.
 *
 * Свободные слоты берутся тем же способом, что и при создании: у заведения
 * спрашивается доступность на выбранный день. Значит гость не может выбрать
 * время, которого нет, — и всё равно возможен отказ в момент отправки, если
 * стол заняли секундой раньше. Этот отказ показывается отдельным текстом, а не
 * общим «что-то пошло не так»: человеку надо понять, что дело не в нём и что
 * достаточно выбрать другое время.
 */
export default function RescheduleBookingScreen() {
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const repository = useRepository();
  const queryClient = useQueryClient();
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();

  const booking = useQuery<Booking>({
    queryKey: ["booking", id],
    queryFn: () => repository.getBooking(id),
    enabled: Boolean(id),
  });

  const [guests, setGuests] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [guestsSheet, setGuestsSheet] = useState(focus === "guests");
  const [failure, setFailure] = useState<string | null>(null);

  const current = booking.data;
  const effectiveGuests = guests ?? current?.guests ?? 2;
  const dateKey = current ? toDateKey(new Date(current.startsAt)) : "";

  const availability = useQuery({
    queryKey: ["availability", current?.restaurantId, dateKey, effectiveGuests],
    queryFn: () =>
      repository.getAvailability({
        restaurantId: current!.restaurantId,
        date: dateKey,
        guests: effectiveGuests,
      }),
    enabled: Boolean(current?.restaurantId && dateKey),
  });

  const slots = useMemo(() => availability.data?.slots ?? [], [availability.data]);

  const reschedule = useMutation({
    mutationFn: () =>
      repository.rescheduleBooking(id, {
        startsAt: slot ?? undefined,
        guests: guests ?? undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["booking", id] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      router.back();
    },
    onError: (error: unknown) => {
      const status = (error as { status?: number } | null)?.status;
      setFailure(status === 409 ? t.booking.rescheduleTaken : t.booking.rescheduleFailed);
    },
  });

  // Отправлять нечего, пока ничего не изменили: кнопка, которая шлёт запрос
  // «оставить как было», только создаёт риск получить отказ на ровном месте.
  const changed = slot !== null || (guests !== null && guests !== current?.guests);

  if (booking.isPending) return <LoadingState title={t.common.loading} />;
  if (booking.isError || !current) {
    return (
      <ErrorState
        title={t.booking.detailErrorTitle}
        description={t.booking.detailErrorDescription}
        action={{ label: t.common.retry, onPress: () => void booking.refetch(), variant: "button" }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.booking.detailsTitle} onBack={() => router.back()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>{t.booking.guestsSectionTitle}</Text>
          <PrimaryButton
            variant="secondary"
            label={t.booking.guestsCount(effectiveGuests)}
            onPress={() => setGuestsSheet(true)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t.booking.timeSectionTitle}</Text>
          <Text style={styles.caption}>
            {`${formatRelativeDay(current.startsAt)}, ${formatTime(current.startsAt)}`}
          </Text>
          {availability.isPending ? (
            <LoadingState title={t.common.loading} />
          ) : (
            <TimeSlotGrid slots={slots} selected={slot} onSelect={(picked) => setSlot(picked.startsAt)} />
          )}
        </View>

        {failure ? (
          <Text style={styles.failure} accessibilityRole="alert">
            {failure}
          </Text>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
        <View style={styles.footer}>
          <PrimaryButton
            size="lg"
            label={reschedule.isPending ? t.booking.submitting : t.booking.rescheduleSubmit}
            disabled={!changed || reschedule.isPending}
            onPress={() => {
              setFailure(null);
              reschedule.mutate();
            }}
          />
        </View>
      </SafeAreaView>

      <WheelSheet
        visible={guestsSheet}
        title={t.booking.pickGuestsTitle}
        options={guestOptions((n) => t.booking.guestsCount(n))}
        value={String(effectiveGuests)}
        submitLabel={t.search.availabilityDone}
        closeLabel={t.search.availabilityClose}
        onClose={() => setGuestsSheet(false)}
        onSubmit={(picked) => {
          setGuestsSheet(false);
          setGuests(Number(picked));
          // Число гостей меняет саму сетку слотов: выбранное время могло
          // подходить для двоих и не подойти для шестерых.
          setSlot(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.background.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  label: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  caption: {
    ...typography.body,
    color: colors.text.muted,
  },
  failure: {
    ...typography.body,
    color: colors.brand.primary,
    paddingHorizontal: spacing.lg,
  },
  footerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  footer: {
    padding: spacing.lg,
  },
});
