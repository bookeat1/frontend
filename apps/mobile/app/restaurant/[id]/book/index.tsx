import type { AvailabilitySlot } from "@bookeat/api";
import { RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateStrip } from "../../../../src/components/DateStrip";
import { FlowHeader } from "../../../../src/components/FlowHeader";
import { CalendarBlank, ForkKnife, User } from "../../../../src/components/icons";
import { MenuItemCard } from "../../../../src/components/MenuItemCard";
import { PillSelect } from "../../../../src/components/PillSelect";
import { PrimaryButton } from "../../../../src/components/PrimaryButton";
import { SelectRow } from "../../../../src/components/SelectRow";
import { EmptyState, ErrorState, LoadingState } from "../../../../src/components/StateViews";
import { TextField } from "../../../../src/components/TextField";
import { TimeSlotGrid } from "../../../../src/components/TimeSlotGrid";
import { useAvailability, useCreateBooking } from "../../../../src/hooks/useBooking";
import { useRestaurant } from "../../../../src/hooks/useRestaurant";
import { useAuth } from "../../../../src/lib/auth";
import { estimatePreorderTotalMinor, useBookingDraft } from "../../../../src/lib/booking-draft";
import { formatDayMonth, formatMoneyMinor, fromDateKey, isSameDay } from "../../../../src/lib/format";

const t = getDictionary();

interface FieldErrors {
  name?: string;
  phone?: string;
}

/** Deliberately loose: KZ mobile numbers are 11 digits, but guests paste all
 * sorts of formatting and a foreign number is legitimate. We only refuse
 * something that cannot be a phone at all — the venue calls the number, the
 * app does not need to parse it. */
function validatePhone(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return t.booking.phoneRequired;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10) return t.booking.phoneInvalid;
  return undefined;
}

export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const draft = useBookingDraft();
  const { status: authStatus, user } = useAuth();

  const { data: restaurant } = useRestaurant(id);
  const availability = useAvailability({
    restaurantId: id,
    date: draft.date,
    guests: draft.guests,
  });
  const createBooking = useCreateBooking();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<{ title: string; description: string } | null>(
    null,
  );

  // Prefill from the account once it is known, without touching anything the
  // guest has already typed (see prefillContact).
  //
  // Depends on the CALLBACK, not on `draft`: the draft object's identity
  // changes on every keystroke, so `[draft, user]` would re-run this effect
  // for each character typed.
  const { prefillContact } = draft;
  useEffect(() => {
    if (user) prefillContact({ name: user.fullName, phone: user.phone });
  }, [prefillContact, user]);

  // Settle the time that was pre-selected from an Explore time pill against
  // the day's real slots, the moment they arrive — and re-check it on every
  // later answer, since the first one can come from the cache Explore filled a
  // minute ago. The draft ignores the call once the guest has chosen a time
  // themselves, so this can never overrule them.
  const { resolvePrefill } = draft;
  const availabilitySlots = availability.data?.slots;
  useEffect(() => {
    if (availabilitySlots) resolvePrefill(availabilitySlots);
  }, [availabilitySlots, resolvePrefill]);

  const selectedDate = useMemo(() => fromDateKey(draft.date), [draft.date]);
  const dateLabel = useMemo(() => {
    const today = new Date();
    if (isSameDay(selectedDate, today)) return t.booking.today;
    if (isSameDay(selectedDate, new Date(today.getTime() + 86_400_000))) return t.booking.tomorrow;
    return formatDayMonth(selectedDate);
  }, [selectedDate]);

  const preorderTotal = estimatePreorderTotalMinor(draft.preorder);
  const preorderCount = draft.preorder.reduce((sum, line) => sum + line.quantity, 0);

  const handleSelectSlot = (slot: AvailabilitySlot) => {
    setSubmitError(null);
    draft.setSlot(slot);
  };

  const validate = (): boolean => {
    const next: FieldErrors = {
      name: draft.name.trim() ? undefined : t.booking.nameRequired,
      phone: validatePhone(draft.phone),
    };
    setErrors(next);
    return !next.name && !next.phone;
  };

  const handleSubmit = () => {
    setSubmitError(null);
    if (!draft.slot || !id) return;
    if (!validate()) return;

    // Not signed in: park the guest at the gate and come straight back here.
    // The draft survives because the gate is pushed on top of this stack.
    if (authStatus !== "signed-in") {
      router.push({ pathname: "/auth/sign-in", params: { reason: "booking" } });
      return;
    }

    createBooking.mutate(
      {
        input: {
          restaurantId: id,
          startsAt: draft.slot.startsAt,
          guests: draft.guests,
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          notes: draft.notes,
        },
        idempotencyKey: draft.idempotencyKey,
        preorder: draft.preorder.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          comment: line.comment,
        })),
      },
      {
        onSuccess: ({ booking, preorderFailed }) => {
          router.replace({
            pathname: "/booking/[id]",
            params: { id: booking.id, preorderFailed: preorderFailed ? "1" : "0" },
          });
        },
        onError: (error) => {
          if (error instanceof RepositoryError && error.isUnauthorized) {
            router.push({ pathname: "/auth/sign-in", params: { reason: "booking" } });
            return;
          }
          if (error instanceof RepositoryError && error.isDuplicateSubmit) {
            // NOT "the slot is gone" — the opposite. The server is saying this
            // exact request already produced a booking. Clearing the slot here
            // (as this branch used to) sent the guest off to pick another time
            // and quietly gave them a SECOND table while they believed they had
            // none. Keep everything and tell them to check their bookings.
            setSubmitError({
              title: t.booking.createErrorDuplicateTitle,
              description: t.booking.createErrorDuplicateDescription,
            });
            return;
          }
          if (error instanceof RepositoryError && error.isSlotConflict) {
            // The slot went while the guest was typing. Drop it and refetch so
            // the grid they look at next is the truth.
            draft.setSlot(null);
            void availability.refetch();
            setSubmitError({
              title: t.booking.createErrorConflictTitle,
              description: t.booking.createErrorConflictDescription,
            });
            return;
          }
          if (error instanceof RepositoryError && error.isValidation) {
            setSubmitError({
              title: t.booking.createErrorValidationTitle,
              description: t.booking.createErrorValidationDescription,
            });
            return;
          }
          setSubmitError({
            title: t.booking.createErrorTitle,
            description: t.booking.createErrorDescription,
          });
        },
      },
    );
  };

  const submitting = createBooking.isPending;
  const canSubmit = Boolean(draft.slot) && !submitting;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        {/* The venue name moved into the first card (node 471:3899); the bar
            itself carries the screen name and a single close control. */}
        <FlowHeader title={t.booking.title} onClose={() => router.back()} />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.section, styles.sectionFirst]}>
            {restaurant ? (
              <View style={styles.venueBox}>
                <Text style={styles.venueName}>{restaurant.name}</Text>
                <Text style={styles.venueAddress}>{restaurant.address}</Text>
              </View>
            ) : null}
            <View style={styles.stripBleed}>
              <DateStrip
                selected={draft.date}
                onSelect={draft.setDate}
                todayLabel={t.booking.today}
                tomorrowLabel={t.booking.tomorrow}
              />
            </View>
            <View style={[styles.sectionBody, styles.pillRow]}>
              <PillSelect
                icon={CalendarBlank}
                accessibilityLabel={t.booking.dateSectionTitle}
                value={dateLabel}
                onPress={() => router.push(`/restaurant/${id}/book/date`)}
              />
              <PillSelect
                icon={User}
                accessibilityLabel={t.booking.guestsSectionTitle}
                value={t.booking.guestsCount(draft.guests)}
                onPress={() => router.push(`/restaurant/${id}/book/guests`)}
              />
            </View>
          </View>

          <View style={[styles.section, styles.sectionRounded]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t.booking.timeSectionTitle}</Text>
              {availability.data ? (
                <Text style={styles.sectionCaption}>
                  {t.booking.slotDuration(availability.data.durationMinutes)}
                </Text>
              ) : null}
            </View>
            <View style={styles.sectionBody}>
              {/* The time the guest tapped on Explore is gone. Say so, right
                  above the grid they now have to choose from — the date and
                  the party size they came with are still selected. */}
              {draft.prefillOutcome === "taken" ? (
                <View style={styles.notice} accessibilityRole="alert">
                  <Text style={styles.noticeTitle}>{t.booking.prefillTakenTitle}</Text>
                  <Text style={styles.noticeText}>{t.booking.prefillTakenDescription}</Text>
                </View>
              ) : null}
              <SlotsSection
                query={availability}
                selected={draft.slot?.startsAt ?? null}
                onSelect={handleSelectSlot}
                onPickAnotherDate={() => router.push(`/restaurant/${id}/book/date`)}
              />
            </View>
          </View>

          <View style={[styles.section, styles.sectionRounded]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t.booking.contactSectionTitle}</Text>
            </View>
            <View style={styles.sectionBody}>
              <TextField
                label={t.booking.nameLabel}
                placeholder={t.booking.namePlaceholder}
                value={draft.name}
                onChangeText={(value) => {
                  draft.setName(value);
                  if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
                }}
                error={errors.name}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
              <TextField
                label={t.booking.phoneLabel}
                placeholder={t.booking.phonePlaceholder}
                value={draft.phone}
                onChangeText={(value) => {
                  draft.setPhone(value);
                  if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
                }}
                error={errors.phone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
              />
            </View>
          </View>

          {/* "Special Requests" is its own card in the design (node 471:3946):
              a titled card with one bare rounded box, no field label. */}
          <View style={[styles.section, styles.sectionRounded]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t.booking.notesLabel}</Text>
            </View>
            <View style={styles.sectionBody}>
              <TextField
                label={t.booking.notesLabel}
                labelHidden
                placeholder={t.booking.notesPlaceholder}
                value={draft.notes}
                onChangeText={draft.setNotes}
                multiline
              />
            </View>
          </View>

          <View style={[styles.section, styles.sectionRounded]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t.booking.preorderSectionTitle}</Text>
              <Text style={styles.sectionCaption}>{t.booking.preorderOptional}</Text>
            </View>
            <View style={styles.sectionBody}>
              <SelectRow
                icon={ForkKnife}
                label={preorderCount > 0 ? t.booking.preorderEdit : t.booking.preorderAdd}
                value={
                  preorderCount > 0
                    ? t.booking.preorderSummary(
                        preorderCount,
                        preorderTotal === undefined
                          ? t.booking.preorderNoPrice
                          : formatMoneyMinor(preorderTotal),
                      )
                    : ""
                }
                placeholder={t.booking.preorderOptional}
                caption={preorderCount > 0 ? t.booking.preorderTotalEstimateNote : undefined}
                onPress={() => router.push(`/restaurant/${id}/book/menu`)}
              />
            </View>
          </View>

          {/* "Top Picks" (node 471:3950). Rendered from the venue payload this
              screen already has — no extra request — and read-only: the design
              gives its cards no visible affordance, and wiring a tap would be a
              behaviour decision, not a visual one. */}
          {restaurant && restaurant.menuHighlights.length > 0 ? (
            <View style={[styles.section, styles.sectionLast]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t.restaurant.menuHighlights}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topPicksRow}
              >
                {restaurant.menuHighlights.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {submitError ? (
            <View style={styles.submitError} accessibilityRole="alert">
              <Text style={styles.submitErrorTitle}>{submitError.title}</Text>
              <Text style={styles.submitErrorText}>{submitError.description}</Text>
            </View>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
          <View style={styles.footer}>
            {authStatus !== "signed-in" ? (
              <Text style={styles.gateNote}>{t.booking.signInGateNote}</Text>
            ) : null}
            <PrimaryButton
              size="lg"
              label={
                submitting
                  ? t.booking.submitting
                  : authStatus === "signed-in"
                    ? t.booking.submit
                    : t.booking.signInToConfirm
              }
              onPress={handleSubmit}
              disabled={!canSubmit}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The four states of the slot list, plus the two shapes of "no slots" the live
 * catalog actually produces:
 *   - no slots at all      -> the venue has no working hours for that day
 *   - every slot "capacity" -> the venue has no tables in the system yet, so
 *     online booking is not possible there at any time. Telling the guest to
 *     "pick another day" would send them round a loop, so this gets its own
 *     copy pointing at the phone.
 */
function SlotsSection({
  query,
  selected,
  onSelect,
  onPickAnotherDate,
}: {
  query: ReturnType<typeof useAvailability>;
  selected: string | null;
  onSelect: (slot: AvailabilitySlot) => void;
  onPickAnotherDate: () => void;
}) {
  if (query.isPending) {
    return <LoadingState title={t.booking.slotsLoading} compact />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={t.booking.slotsErrorTitle}
        description={t.booking.slotsErrorDescription}
        retryLabel={t.common.retry}
        onRetry={() => void query.refetch()}
        compact
      />
    );
  }

  const slots = query.data.slots;
  if (slots.length === 0) {
    return (
      <EmptyState
        title={t.booking.slotsClosedTitle}
        description={t.booking.slotsClosedDescription}
        actionLabel={t.booking.pickAnotherDate}
        onAction={onPickAnotherDate}
        compact
      />
    );
  }

  const anyAvailable = slots.some((slot) => slot.available);
  if (!anyAvailable) {
    const everySlotCapacity = slots.every((slot) => slot.reason === "capacity");
    return everySlotCapacity ? (
      <EmptyState
        title={t.booking.slotsNoTablesTitle}
        description={t.booking.slotsNoTablesDescription}
        compact
      />
    ) : (
      <EmptyState
        title={t.booking.slotsAllTakenTitle}
        description={t.booking.slotsAllTakenDescription}
        actionLabel={t.booking.pickAnotherDate}
        onAction={onPickAnotherDate}
        compact
      />
    );
  }

  return <TimeSlotGrid slots={slots} selected={selected} onSelect={onSelect} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  flex: {
    flex: 1,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  // Cards are full-bleed with 16 of inner padding and 24 between their blocks
  // (nodes 471:3899 / 3914 / 3946 / 3950). The stack's outer corners are the
  // only ones that stay square: the first card is rounded at the bottom, the
  // last at the top, everything between is rounded all round.
  section: {
    backgroundColor: colors.background.surface,
    paddingVertical: spacing.lg,
    gap: spacing.xxl,
  },
  sectionFirst: {
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  sectionRounded: {
    borderRadius: radius.card,
  },
  sectionLast: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xxs,
  },
  sectionBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  venueBox: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xxs,
  },
  venueName: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  // Dark, not muted — the design's address line is #1B1B1B (node 471:3899).
  venueAddress: {
    ...typography.body,
    color: colors.text.primary,
  },
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  topPicksRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  // The date strip scrolls edge to edge; its own contentContainer carries the
  // page padding so the first cell doesn't look clipped.
  stripBleed: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  sectionCaption: {
    ...typography.caption,
    color: colors.text.muted,
  },
  // Same block the submit errors use, minus the screen gutter: this one sits
  // INSIDE a card that already carries the padding.
  notice: {
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    gap: spacing.xxs,
  },
  noticeTitle: {
    ...typography.labelSemiBold,
    color: colors.brand.primary,
  },
  noticeText: {
    ...typography.body,
    color: colors.text.primary,
  },
  submitError: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    gap: spacing.xs,
  },
  submitErrorTitle: {
    ...typography.labelSemiBold,
    color: colors.brand.primary,
  },
  submitErrorText: {
    ...typography.body,
    color: colors.text.primary,
  },
  footerSafeArea: {
    backgroundColor: colors.background.surface,
    // 0 -8 16 at 8% black (node 471:3967); the alpha lives in the token, so
    // shadowOpacity is left at full strength.
    shadowColor: colors.overlay.footerShadow,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 16,
    elevation: 8,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  gateNote: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: "center",
  },
});
