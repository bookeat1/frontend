import type { AvailabilitySlot, BookingConflictKind, DayOfWeek } from "@bookeat/api";
import { RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { openPhone } from "../../../../src/lib/external-links";
import { formatDayMonth, formatMoneyMinor, fromDateKey, isSameDay } from "../../../../src/lib/format";
import { dayHoursLabel, scheduleDayFor } from "../../../../src/lib/schedule";

const t = getDictionary();

interface FieldErrors {
  name?: string;
  phone?: string;
}

/** What the guest is shown after a failed submit. `action` is the way out of
 * the failure (their bookings list, the party-size picker); `blocksSubmit`
 * means we KNOW a booking already exists, so the button must not fire again. */
interface SubmitError {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  blocksSubmit?: boolean;
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
    // Заведение без онлайн-брони не спрашиваем вообще — см. useAvailability.
    acceptsOnlineBookings: restaurant?.acceptsOnlineBookings,
  });
  const createBooking = useCreateBooking();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);

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

  /**
   * Подсказка под пустым списком слотов — из СТРУКТУРНОГО графика на выбранный
   * день, а не из свободнотекстовой строки заведения. Три исхода, и они
   * разные: выходной, «работает с … до …» (значит, дело не в графике) и
   * «сервер про этот день не сказал» — тогда молчим, а не выдумываем.
   */
  const selectedDayHint = useMemo(() => {
    const schedule = restaurant?.schedule;
    if (!schedule) return null;
    const day = scheduleDayFor(schedule, fromDateKey(draft.date).getDay() as DayOfWeek);
    if (!day) return null;
    if (!day.isOpen) return t.booking.slotsClosedDayOff;
    if (!day.opensAt || !day.closesAt) return null;
    return t.booking.slotsClosedSchedule(dayHoursLabel(day));
  }, [restaurant?.schedule, draft.date]);

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

  const goToMyBookings = () => router.push("/bookings");

  /**
   * The four ways POST /bookings can answer 409, and the only two questions
   * that matter for each: does the guest have a booking, and may they submit
   * again?
   *
   * IDEMPOTENCY-KEY, per branch:
   *   - slot_taken / no_table_available — no booking exists. The selected time
   *     is cleared, and clearing it rotates the key (BookingDraftProvider
   *     rotates on any change to the request body: venue, day, party size,
   *     slot, contacts). The guest's next submit is a genuinely new request.
   *   - idempotency_key_reused — a booking DOES exist. Nothing about the draft
   *     is touched, so the key does NOT rotate, and the submit button is
   *     locked on top of that: rotating the key and resending is exactly what
   *     would produce a second table.
   *   - unknown — the draft is frozen for the same reason. Because the key
   *     stays put, pressing "Забронировать" again resolves the ambiguity
   *     safely by itself: if the earlier submit did go through, the backend
   *     replays that same booking (identical body + identical key); if it did
   *     not, the request is simply attempted again.
   */
  const handleBookingConflict = (conflict: BookingConflictKind) => {
    switch (conflict) {
      case "slot_taken":
        // No booking was created. The slot went while the guest was typing:
        // drop it and refetch so the grid they look at next is the truth.
        draft.setSlot(null);
        void availability.refetch();
        setSubmitError({
          title: t.booking.createErrorConflictTitle,
          description: t.booking.createErrorConflictDescription,
        });
        return;
      case "no_table_available":
        // No booking either — but picking another time is not the only fix,
        // a smaller party may still fit, so offer that route explicitly.
        draft.setSlot(null);
        void availability.refetch();
        setSubmitError({
          title: t.booking.createErrorNoTableTitle,
          description: t.booking.createErrorNoTableDescription(draft.guests),
          action: {
            label: t.booking.createErrorChangeGuests,
            onPress: () => router.push(`/restaurant/${id}/book/guests`),
          },
        });
        return;
      case "idempotency_key_reused":
        // The OPPOSITE of a lost slot: this exact request already produced a
        // booking. Keep the draft intact and stop the flow here.
        setSubmitError({
          title: t.booking.createErrorDuplicateTitle,
          description: t.booking.createErrorDuplicateDescription,
          action: { label: t.booking.createErrorOpenMyBookings, onPress: goToMyBookings },
          blocksSubmit: true,
        });
        return;
      case "unknown":
        // An older server build: the same 409 covers both outcomes and we
        // cannot tell them apart. Say nothing we do not know — claiming a
        // booking that does not exist is what makes a guest not turn up —
        // and send them to check. The draft is left exactly as it is.
        setSubmitError({
          title: t.booking.createErrorAmbiguousTitle,
          description: t.booking.createErrorAmbiguousDescription,
          action: { label: t.booking.createErrorOpenMyBookings, onPress: goToMyBookings },
        });
        return;
    }
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
            params: {
              id: booking.id,
              preorderFailed: preorderFailed ? "1" : "0",
              // Marks THIS arrival as "the booking was just made here", which
              // is the only moment the reservation screen offers to turn on
              // notifications. A deep link or a visit from «Мои брони» carries
              // no such flag and shows no card.
              created: "1",
            },
          });
        },
        onError: (error) => {
          if (error instanceof RepositoryError && error.isUnauthorized) {
            router.push({ pathname: "/auth/sign-in", params: { reason: "booking" } });
            return;
          }
          // A 409 is FOUR different outcomes, told apart only by the server's
          // machine-readable `code` (never by the English message, which is
          // the same "already exists" for all of them). Two of them mean the
          // guest has NO booking, one means they DO, and the fourth is an
          // older server build that will not say which.
          const conflict =
            error instanceof RepositoryError ? error.bookingConflict : null;
          if (conflict) {
            handleBookingConflict(conflict);
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
  // `blocksSubmit` is set only when the server told us a booking already
  // exists. It is deliberately NOT cleared by editing the form: any edit
  // rotates the Idempotency-Key, so an "edit and resend" is what would create
  // the second table. The way out is the bookings list.
  const canSubmit = Boolean(draft.slot) && !submitting && !submitError?.blocksSubmit;

  /**
   * Заведение вообще не принимает онлайн-бронь (`accepts_online_bookings:
   * false`) — форму не показываем совсем.
   *
   * Раньше сюда можно было зайти, выбрать дату, дождаться слотов и получить
   * отказ по каждому из них; на «Adept» это выяснялось на четвёртой дате.
   * Теперь факт известен до первого запроса, и экран сразу даёт единственный
   * рабочий выход — телефон заведения. На экран всё ещё можно попасть по
   * прямой ссылке, поэтому проверка живёт здесь, а не только на кнопке.
   */
  if (restaurant && !restaurant.acceptsOnlineBookings) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <FlowHeader title={t.booking.title} onClose={() => router.back()} />
        </SafeAreaView>
        <EmptyState
          title={t.restaurant.bookingUnavailableTitle}
          description={
            restaurant.phone
              ? t.restaurant.bookingUnavailableDescription
              : t.restaurant.bookingUnavailableNoPhone
          }
          actionLabel={restaurant.phone ? t.restaurant.callToBook : undefined}
          onAction={
            restaurant.phone ? () => void openPhone(restaurant.phone ?? "") : undefined
          }
        />
      </View>
    );
  }

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
                dayHint={selectedDayHint}
                phone={restaurant?.phone}
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
              {submitError.action ? (
                <PrimaryButton
                  label={submitError.action.label}
                  onPress={submitError.action.onPress}
                  variant="secondary"
                />
              ) : null}
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
 *
 *   - no slots at all       -> the venue is closed that day. The guest is
 *     offered another date, and the venue's schedule FOR THAT DAY, read from
 *     the server's structured `schedule` — "выходной" and "работает 19:00 –
 *     до полуночи" are different answers and now read differently.
 *   - every slot "capacity" -> no table in the system fits this party. For a
 *     venue that DOES accept online bookings this is about the party size, not
 *     about the venue, so the way out is another date or fewer guests.
 *
 * A venue that cannot be booked online at all never reaches this component:
 * `accepts_online_bookings` is known before the first request and the screen
 * returns its own state above. That flag is what replaced the old guesswork
 * (ASSUMED_IS_BOOKABLE + "all slots came back capacity, so probably…").
 */
function SlotsSection({
  query,
  selected,
  onSelect,
  onPickAnotherDate,
  dayHint,
  phone,
}: {
  query: ReturnType<typeof useAvailability>;
  selected: string | null;
  onSelect: (slot: AvailabilitySlot) => void;
  onPickAnotherDate: () => void;
  /** Что график заведения говорит про ВЫБРАННЫЙ день, или null — если сервер
   * про этот день ничего не сказал. */
  dayHint: string | null;
  phone?: string;
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
        description={
          dayHint
            ? `${dayHint}\n${t.booking.slotsClosedDescription}`
            : t.booking.slotsClosedDescription
        }
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
        // Телефон настоящий, из карточки заведения. Кнопки «выбрать другую
        // дату» здесь нет намеренно: сюда попадает заведение, которое брони
        // принимает, но подходящего столика на эту компанию не нашлось ни в
        // одном слоте дня, — звонок разрулит это быстрее перебора дат.
        actionLabel={phone ? t.booking.slotsNoTablesCall(phone) : undefined}
        onAction={phone ? () => void openPhone(phone) : undefined}
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
