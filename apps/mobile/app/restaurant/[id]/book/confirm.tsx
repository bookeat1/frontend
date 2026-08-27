import type { BookingConflictKind } from "@bookeat/api";
import { RepositoryError } from "@bookeat/api";
import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../../src/components/FlowHeader";
import { CalendarBlank, Minus, Plus, User } from "../../../../src/components/icons";
import { MenuHighlightsStrip } from "../../../../src/components/restaurant/MenuHighlightsStrip";
import { PhotoView } from "../../../../src/components/PhotoView";
import { PrimaryButton } from "../../../../src/components/PrimaryButton";
import { useCreateBooking } from "../../../../src/hooks/useBooking";
import { useRestaurant } from "../../../../src/hooks/useRestaurant";
import { trackEvent } from "../../../../src/lib/analytics";
import { useAuth } from "../../../../src/lib/auth";
import {
  estimatePreorderTotalMinor,
  useAddDishToPreorder,
  useBookingDraft,
  type PreorderDraftLine,
} from "../../../../src/lib/booking-draft";
import { formatDayMonth, formatMoneyMinor, formatTime, fromDateKey, isSameDay } from "../../../../src/lib/format";
import { formatStoredPhoneForDisplay } from "../../../../src/lib/phone";

const t = getDictionary();

/** What the guest is shown after a failed submit — same contract the reservation
 * screen used before this step moved here. `blocksSubmit` means the server told
 * us a booking already exists, so the button must not fire again. */
interface SubmitError {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  blocksSubmit?: boolean;
}

/**
 * The review-and-confirm step (design frame 918:12078).
 *
 * This is where the booking is actually created: the reservation screen builds
 * the draft, the guest reviews it here, and «Подтвердить бронь» calls the SAME
 * create-booking path the flow has always used — the 409 handling below is the
 * same four-outcome logic, moved verbatim from the reservation screen.
 *
 * Identity is READ-ONLY and comes from the signed-in account (owner's rule): the
 * screen is only reachable once signed in (the gate is on «Продолжить»), so name
 * and phone are the account's, never collected here.
 */
export default function ConfirmBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const draft = useBookingDraft();
  const { status: authStatus, user } = useAuth();
  const { data: restaurant } = useRestaurant(id);
  const createBooking = useCreateBooking();

  const [submitError, setSubmitError] = useState<SubmitError | null>(null);

  // Тот же колбэк, что на шаге брони: «Добавить» с ленты пишет в ЭТОТ же
  // черновик, который экран показывает списком выше. Бронь ещё не создана —
  // предзаказ здесь правится степперами, поэтому и добавить в него можно.
  const addDishToPreorder = useAddDishToPreorder();

  // Defences against arriving here in a state that cannot be submitted. Neither
  // should happen through the flow (the gate is on «Продолжить», and Continue is
  // disabled without a slot), but a session can expire on this very screen and a
  // slot can be cleared by an edit, so both are handled rather than trusted.
  useEffect(() => {
    if (authStatus === "signed-out") {
      router.replace({ pathname: "/auth/sign-in", params: { reason: "booking" } });
    }
  }, [authStatus, router]);
  useEffect(() => {
    if (!draft.slot) router.back();
  }, [draft.slot, router]);

  const dateLabel = useMemo(() => {
    const date = fromDateKey(draft.date);
    const today = new Date();
    if (isSameDay(date, today)) return t.booking.today;
    if (isSameDay(date, new Date(today.getTime() + 86_400_000))) return t.booking.tomorrow;
    return formatDayMonth(date);
  }, [draft.date]);

  const preorderTotal = estimatePreorderTotalMinor(draft.preorder);

  // Identity is the account's; the draft copy (prefilled from it on the
  // reservation screen) is only a fallback for the instant before /users/me has
  // answered. What is submitted and what is shown are therefore the same value.
  const contactName = (user?.fullName ?? "").trim() || draft.name.trim();
  const contactPhoneRaw = (user?.phone ?? "").trim() || draft.phone.trim();
  const contactPhone = contactPhoneRaw ? formatStoredPhoneForDisplay(contactPhoneRaw) : "";

  const goToMyBookings = () => router.push("/bookings");

  /**
   * The four ways POST /bookings can answer 409 — see the long note this logic
   * carried on the reservation screen. Unchanged: the branch is chosen by the
   * server's machine-readable `code`, and each one differs on the only two
   * questions that matter — does a booking exist, and may the guest submit again.
   */
  const handleBookingConflict = (conflict: BookingConflictKind) => {
    switch (conflict) {
      case "slot_taken":
        // No booking was created; the slot went while the guest reviewed. Drop
        // it and send them back to pick another — the grid lives there.
        draft.setSlot(null);
        setSubmitError({
          title: t.booking.createErrorConflictTitle,
          description: t.booking.createErrorConflictDescription,
          action: { label: t.booking.pickAnotherDate, onPress: () => router.back() },
        });
        return;
      case "no_table_available":
        draft.setSlot(null);
        setSubmitError({
          title: t.booking.createErrorNoTableTitle,
          description: t.booking.createErrorNoTableDescription(draft.guests),
          // Back to the reservation step: changing the party size there clears
          // and re-picks the time, which is exactly what this outcome needs.
          action: { label: t.booking.createErrorChangeGuests, onPress: () => router.back() },
        });
        return;
      case "idempotency_key_reused":
        setSubmitError({
          title: t.booking.createErrorDuplicateTitle,
          description: t.booking.createErrorDuplicateDescription,
          action: { label: t.booking.createErrorOpenMyBookings, onPress: goToMyBookings },
          blocksSubmit: true,
        });
        return;
      case "unknown":
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
    // Belt and braces: the screen is auth-gated, but a session can lapse while
    // it is open. Send them to sign in rather than fire a guaranteed 401.
    if (authStatus !== "signed-in" || !contactName || !contactPhoneRaw) {
      router.push({ pathname: "/auth/sign-in", params: { reason: "booking" } });
      return;
    }

    createBooking.mutate(
      {
        input: {
          restaurantId: id,
          startsAt: draft.slot.startsAt,
          guests: draft.guests,
          name: contactName,
          phone: contactPhoneRaw,
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
          trackEvent("booking_confirm", { restaurant_id: id });
          router.replace({
            pathname: "/booking/[id]",
            params: {
              id: booking.id,
              preorderFailed: preorderFailed ? "1" : "0",
              created: "1",
            },
          });
        },
        onError: (error) => {
          if (error instanceof RepositoryError && error.isUnauthorized) {
            router.push({ pathname: "/auth/sign-in", params: { reason: "booking" } });
            return;
          }
          const conflict = error instanceof RepositoryError ? error.bookingConflict : null;
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
  const canSubmit =
    Boolean(draft.slot) &&
    Boolean(contactName) &&
    Boolean(contactPhoneRaw) &&
    !submitting &&
    !submitError?.blocksSubmit;

  // Both Edit affordances go back to the reservation step: date, time and party
  // size are all chosen there, and changing the party size re-picks the time —
  // which is why editing guests on a separate screen would leave this one with
  // no slot to confirm.
  const editStep = () => router.back();

  const leaveFlow = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.back();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.booking.confirmTitle} onBack={() => router.back()} onClose={leaveFlow} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Venue header, centred (node 918:12098): a 64pt photo over the name
            and address. */}
        {restaurant ? (
          <View style={styles.venueHeader}>
            <PhotoView
              uri={restaurant.coverPhoto?.uri}
              alt={restaurant.coverPhoto?.alt}
              style={styles.venuePhoto}
              size="tile"
              decorative
            />
            <Text style={styles.venueName}>{restaurant.name}</Text>
            <Text style={styles.venueAddress}>{restaurant.address}</Text>
          </View>
        ) : null}

        {/* Details (node 918:12103): date & time and guests, each with an Edit. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.booking.confirmDetailsTitle}</Text>
          <DetailRow
            icon={CalendarBlank}
            label={t.booking.confirmDateTimeLabel}
            value={t.booking.confirmDateTimeValue(
              dateLabel,
              draft.slot ? formatTime(draft.slot.startsAt) : "",
            )}
            onEdit={editStep}
          />
          <DetailRow
            icon={User}
            label={t.booking.confirmGuestsLabel}
            value={t.booking.guestsCount(draft.guests)}
            onEdit={editStep}
          />
        </View>

        {/* Особые пожелания (node 918:12120) — read-only here; edited on the
            reservation step. Hidden when empty: nothing to review. */}
        {draft.notes.trim() ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.booking.specialRequestsTitle}</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{draft.notes.trim()}</Text>
            </View>
          </View>
        ) : null}

        {/* Предзаказ (node 918:12124) with ± steppers. Editing here writes
            straight to the draft; a line dropped to zero is removed. */}
        {draft.preorder.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{t.booking.preorderSectionTitle}</Text>
              <Text style={styles.preorderTotal}>
                {preorderTotal === undefined
                  ? t.booking.preorderNoPrice
                  : formatMoneyMinor(preorderTotal)}
              </Text>
            </View>
            {draft.preorder.map((line) => (
              <PreorderRow
                key={line.menuItemId}
                line={line}
                onChange={(quantity) =>
                  draft.setPreorderQuantity(
                    { menuItemId: line.menuItemId, name: line.name, priceMinor: line.priceMinor },
                    quantity,
                  )
                }
              />
            ))}
          </View>
        ) : null}

        {/* Контакты (owner's rule): name + phone from the account, read-only. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.booking.contactSectionTitle}</Text>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>{t.booking.nameLabel}</Text>
            <Text style={[styles.contactValue, !contactName && styles.contactMissing]}>
              {contactName || t.booking.contactNameMissing}
            </Text>
          </View>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>{t.booking.phoneLabel}</Text>
            <Text style={[styles.contactValue, !contactPhone && styles.contactMissing]}>
              {contactPhone || t.booking.contactPhoneMissing}
            </Text>
          </View>
        </View>

        {/* Top Picks (node 918:12160) — из того же ответа о заведении. Тап
            открывает карточку блюда поверх экрана, и с 2026-08-27 из неё же
            блюдо кладётся в предзаказ: владелец сравнил этот экран с экраном
            меню и попросил, чтобы карточка была одна и та же. Бронь на этом
            шаге ещё НЕ создана — предзаказ выше правится степперами, — так что
            добавление уходит в тот же черновик, а не в созданную бронь.

            Пока идёт отправка, добавлять уже нечего: тело запроса собрано, и
            новая позиция в него не попадёт. Поэтому на время `submitting`
            карточка снова читательская. */}
        {restaurant && restaurant.menuHighlights.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.restaurant.menuHighlights}</Text>
            <MenuHighlightsStrip
              items={restaurant.menuHighlights}
              contentContainerStyle={styles.topPicksRow}
              onAdd={submitting ? undefined : addDishToPreorder}
            />
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
          <PrimaryButton
            size="lg"
            label={submitting ? t.booking.submitting : t.booking.confirmSubmit}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** One line of the Details card: icon, label over value, and an «Изменить» that
 * returns to the step where the value is chosen. */
function DetailRow({
  icon: Icon,
  label,
  value,
  onEdit,
}: {
  icon: typeof CalendarBlank;
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <View style={styles.detailRow}>
      <Icon size={24} color={colors.text.primary} />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.booking.edit}: ${label}`}
        onPress={onEdit}
        style={styles.editButton}
      >
        <Text style={styles.editLabel}>{t.booking.edit}</Text>
      </Pressable>
    </View>
  );
}

/** One pre-order line with a −/＋ stepper (node 918:12126). Minus at quantity 1
 * removes the line. An unpriced dish still shows and still steps — the venue
 * prices it on its side. */
function PreorderRow({
  line,
  onChange,
}: {
  line: PreorderDraftLine;
  onChange: (quantity: number) => void;
}) {
  return (
    <View style={styles.preorderRow}>
      <View style={styles.preorderText}>
        <Text style={styles.preorderName} numberOfLines={2}>
          {line.name}
        </Text>
        <Text style={styles.preorderPrice}>
          {line.priceMinor === null
            ? t.booking.preorderNoPrice
            : formatMoneyMinor(line.priceMinor)}
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.booking.dishRemove}: ${line.name}`}
          onPress={() => onChange(line.quantity - 1)}
          hitSlop={8}
          style={styles.stepperButton}
        >
          <Minus size={18} color={colors.text.primary} weight="bold" />
        </Pressable>
        <Text style={styles.stepperValue}>{line.quantity}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.booking.dishAdd}: ${line.name}`}
          onPress={() => onChange(line.quantity + 1)}
          hitSlop={8}
          style={styles.stepperButton}
        >
          <Plus size={18} color={colors.text.primary} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Тот же серый фон, что и на первом шаге брони: экраны идут подряд, и
    // менять под ними фон на середине пути незачем.
    backgroundColor: colors.background.screen,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  venueHeader: {
    backgroundColor: colors.background.surface,
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.xs,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  venuePhoto: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  venueName: {
    ...typography.titleLg,
    color: colors.text.primary,
    textAlign: "center",
  },
  venueAddress: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preorderTotal: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  detailText: {
    flex: 1,
    gap: spacing.xxs,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  detailValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  editButton: {
    minHeight: hitSlop.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  editLabel: {
    ...typography.labelMedium,
    color: colors.brand.primary,
  },
  notesBox: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  notesText: {
    ...typography.body,
    color: colors.text.primary,
  },
  preorderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  // flex:1 keeps a long Russian dish name wrapping instead of shoving the
  // stepper off a 360pt screen.
  preorderText: {
    flex: 1,
    gap: spacing.xxs,
  },
  preorderName: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  preorderPrice: {
    ...typography.labelSemiBold,
    color: colors.text.strong,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  stepperButton: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
    minWidth: 20,
    textAlign: "center",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  contactLabel: {
    ...typography.body,
    color: colors.text.muted,
  },
  contactValue: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1,
    textAlign: "right",
  },
  contactMissing: {
    color: colors.text.muted,
  },
  topPicksRow: {
    flexDirection: "row",
    gap: spacing.sm,
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
