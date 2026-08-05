import type { AvailabilitySlot, DayOfWeek } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { SegmentedTabs } from "../../../../src/components/SegmentedTabs";
import { SelectRow } from "../../../../src/components/SelectRow";
import { EmptyState, ErrorState, LoadingState } from "../../../../src/components/StateViews";
import { TextField } from "../../../../src/components/TextField";
import { TimeSlotGrid } from "../../../../src/components/TimeSlotGrid";
import { useAvailability } from "../../../../src/hooks/useBooking";
import { useRestaurant } from "../../../../src/hooks/useRestaurant";
import { useAuth } from "../../../../src/lib/auth";
import { estimatePreorderTotalMinor, useBookingDraft } from "../../../../src/lib/booking-draft";
import { openPhone } from "../../../../src/lib/external-links";
import { formatDayMonth, formatMoneyMinor, fromDateKey, isSameDay } from "../../../../src/lib/format";
import { dayHoursLabel, scheduleDayFor } from "../../../../src/lib/schedule";

const t = getDictionary();

/**
 * The hour that splits the day's slots into the «Обед» and «Ужин» tabs (node
 * 918:11747). A threshold, not the venue's real schedule: every venue keeps
 * its own hours, and this only decides which of two tabs a slot lands under so
 * a long day of times reads as two short lists instead of one tall one.
 */
const LUNCH_ENDS_HOUR = 18;

/** Which tab a slot belongs to, by its LOCAL start hour. */
function isLunchSlot(startsAt: string): boolean {
  return new Date(startsAt).getHours() < LUNCH_ENDS_HOUR;
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

  // Обед / Ужин. Держим индекс здесь, а не в списке слотов, чтобы он пережил
  // перерисовку грида при смене выбранного времени.
  const [activeTab, setActiveTab] = useState(0);

  // Prefill name/phone from the account once it is known, so the Confirmation
  // screen has a contact to show and the create-booking body matches the draft
  // the Idempotency-Key was built from. Never clobbers anything (prefillContact
  // only fills an empty field), and the reservation screen no longer collects
  // either one — they are read-only on Confirmation, per the account.
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

  // Land on the tab that actually has free time. Runs once, when the first real
  // list arrives: after that the tab is the guest's to switch, and re-picking
  // it under them on every refetch would be a bug.
  const didInitTab = useRef(false);
  useEffect(() => {
    if (didInitTab.current || !availabilitySlots || availabilitySlots.length === 0) return;
    didInitTab.current = true;
    const lunchFree = availabilitySlots.some((s) => s.available && isLunchSlot(s.startsAt));
    const dinnerFree = availabilitySlots.some((s) => s.available && !isLunchSlot(s.startsAt));
    if (!lunchFree && dinnerFree) setActiveTab(1);
  }, [availabilitySlots]);

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
    draft.setSlot(slot);
  };

  /**
   * "Продолжить" is where the auth-gate lives now (owner's rule): a guest who is
   * not signed in the moment they move to confirm is sent to sign-in and lands
   * back on THIS screen afterwards (the gate is pushed on top of the stack, so
   * the draft survives). Identity is never collected here — name and phone come
   * from the account and are shown read-only on the Confirmation screen.
   */
  const handleContinue = () => {
    if (!draft.slot || !id) return;
    if (authStatus !== "signed-in") {
      router.push({ pathname: "/auth/sign-in", params: { reason: "booking" } });
      return;
    }
    router.push(`/restaurant/${id}/book/confirm`);
  };

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
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </View>
          </View>

          {/* "Special Requests" is its own card in the design (node 471:3946 /
              918:11747): a titled card with one bare rounded box, no field
              label. It stays editable here; Confirmation shows it read-only. */}
          <View style={[styles.section, styles.sectionRounded]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t.booking.specialRequestsTitle}</Text>
            </View>
            <View style={styles.sectionBody}>
              <TextField
                label={t.booking.specialRequestsTitle}
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
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
          <View style={styles.footer}>
            <PrimaryButton
              size="lg"
              label={t.booking.continueToConfirm}
              onPress={handleContinue}
              disabled={!draft.slot}
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
 *
 * The available times are split into «Обед / Ужин» tabs (node 918:11747): the
 * closed / all-taken / no-table states are read from the WHOLE day, so a venue
 * that is shut is not reported as merely "no dinner slots".
 */
function SlotsSection({
  query,
  selected,
  onSelect,
  onPickAnotherDate,
  dayHint,
  phone,
  activeTab,
  onTabChange,
}: {
  query: ReturnType<typeof useAvailability>;
  selected: string | null;
  onSelect: (slot: AvailabilitySlot) => void;
  onPickAnotherDate: () => void;
  /** Что график заведения говорит про ВЫБРАННЫЙ день, или null — если сервер
   * про этот день ничего не сказал. */
  dayHint: string | null;
  phone?: string;
  activeTab: number;
  onTabChange: (index: number) => void;
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

  // Both tabs are always shown once the day has any time at all: the split is a
  // grouping, not a claim about the venue, so an empty tab reads "не в этот
  // период" — it never means the venue is closed (that state is handled above).
  const tabSlots = slots.filter((slot) =>
    activeTab === 0 ? isLunchSlot(slot.startsAt) : !isLunchSlot(slot.startsAt),
  );
  return (
    <View style={styles.slotsBlock}>
      <SegmentedTabs
        labels={[t.booking.lunch, t.booking.dinner]}
        activeIndex={activeTab}
        onChange={onTabChange}
      />
      {tabSlots.length > 0 ? (
        <TimeSlotGrid slots={tabSlots} selected={selected} onSelect={onSelect} />
      ) : (
        <Text style={styles.tabEmpty}>{t.booking.slotsNoneInPeriod}</Text>
      )}
    </View>
  );
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
  // Tabs sit above the grid with the same 16 gap the card body uses between
  // its rows.
  slotsBlock: {
    gap: spacing.md,
  },
  tabEmpty: {
    ...typography.body,
    color: colors.text.muted,
  },
  // Same block the notices use, minus the screen gutter: this one sits INSIDE
  // a card that already carries the padding.
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
});
