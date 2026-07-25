import type { BookingStatus } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../src/components/FlowHeader";
import { CheckCircle, Clock, Note, Users, WarningCircle } from "../../../src/components/icons";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { useBooking, usePreorder } from "../../../src/hooks/useBooking";
import { formatDateTime, formatMoneyMinor } from "../../../src/lib/format";

const t = getDictionary();

/**
 * Confirmation.
 *
 * The booking is re-read from the server rather than trusting what the create
 * call returned, so a manually-confirmed venue that answered `pending` and a
 * venue that auto-confirms both show the truth after a pull-to-refresh, and a
 * deep link into this screen works with no create call at all.
 *
 * `preorderFailed=1` is passed by the reservation screen when the booking was
 * created but attaching the pre-order failed. That is NOT a failed booking —
 * the table is held — so it renders as a notice, not as an error state over
 * the whole screen.
 */
export default function BookingConfirmationScreen() {
  const { id, preorderFailed } = useLocalSearchParams<{ id: string; preorderFailed?: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  const preorder = usePreorder(id);
  const showPreorderWarning = preorderFailed === "1";

  if (booking.isPending) {
    return (
      <SafeAreaView style={styles.stateRoot}>
        <LoadingState title={t.booking.bookingLoading} />
      </SafeAreaView>
    );
  }

  if (booking.isError || !booking.data) {
    return (
      <SafeAreaView style={styles.stateRoot}>
        <ErrorState
          title={t.booking.bookingErrorTitle}
          description={t.search.errorDescription}
          retryLabel={t.common.retry}
          onRetry={() => void booking.refetch()}
        />
      </SafeAreaView>
    );
  }

  const data = booking.data;
  const { title, subtitle, tone } = headline(data.status);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader
          title={t.booking.title}
          // The flow that led here was replaced, so "назад" must not walk back
          // into a submitted form. Go to the venue instead.
          onBack={() => router.replace(`/restaurant/${data.restaurantId}`)}
        />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {tone === "positive" ? (
            <CheckCircle size={64} color={colors.brand.primary} weight="fill" />
          ) : (
            <WarningCircle size={64} color={colors.text.muted} weight="regular" />
          )}
          <Text style={styles.heroTitle} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </View>

        <View style={styles.card}>
          <DetailRow
            icon={Clock}
            label={t.booking.whenLabel}
            value={formatDateTime(data.startsAt)}
          />
          <DetailRow
            icon={Users}
            label={t.booking.guestsSectionTitle}
            value={t.booking.guestsCount(data.guests)}
          />
          <DetailRow
            icon={Note}
            label={t.booking.whoLabel}
            value={`${data.name}${data.phone ? `, ${data.phone}` : ""}`}
          />
          <DetailRow
            icon={CheckCircle}
            label={t.booking.statusLabel}
            value={t.booking.status[data.status]}
          />
          {data.notes ? (
            <DetailRow icon={Note} label={t.booking.notesLabel} value={data.notes} />
          ) : null}
        </View>

        {data.freeCancelDeadline ? (
          <Text style={styles.freeCancel}>
            {t.booking.freeCancelUntil(formatDateTime(data.freeCancelDeadline))}
          </Text>
        ) : null}

        {/* The booking itself succeeded — the table is held. Only attaching
            the pre-order failed (already retried once inside the mutation).
            There is deliberately NO retry button here: the flow's draft is
            gone by this point, so a button labelled "повторить" would have
            nothing to send. Re-ordering needs a booking-scoped menu screen,
            which does not exist yet. */}
        {showPreorderWarning ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Text style={styles.noticeText}>{t.booking.preorderSaveFailed}</Text>
          </View>
        ) : null}

        {preorder.data && preorder.data.items.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.booking.preorderSectionTitle}</Text>
            {preorder.data.items.map((item) => (
              <View key={item.id} style={styles.preorderRow}>
                <Text style={styles.preorderName} numberOfLines={2}>
                  {item.quantity} × {item.name}
                </Text>
                <Text style={styles.preorderPrice}>{formatMoneyMinor(item.totalMinor)}</Text>
              </View>
            ))}
            <View style={styles.preorderRow}>
              <Text style={styles.preorderTotalLabel}>{t.booking.preorderSectionTitle}</Text>
              <Text style={styles.preorderTotalValue}>
                {formatMoneyMinor(preorder.data.totalMinor)}
              </Text>
            </View>
          </View>
        ) : null}

        <PrimaryButton
          label={t.booking.whatsNext}
          variant="secondary"
          onPress={() => router.push(`/booking/${data.id}/next`)}
        />
        <PrimaryButton
          label={t.booking.backToVenue}
          variant="secondary"
          onPress={() => router.replace(`/restaurant/${data.restaurantId}`)}
        />
      </ScrollView>
    </View>
  );
}

function headline(status: BookingStatus): {
  title: string;
  subtitle: string;
  tone: "positive" | "neutral";
} {
  switch (status) {
    case "confirmed":
    case "arrived":
    case "completed":
      return {
        title: t.booking.confirmedTitle,
        subtitle: t.booking.confirmedSubtitle,
        tone: "positive",
      };
    case "cancelled":
    case "no_show":
      return {
        title: t.booking.cancelledTitle,
        subtitle: t.booking.cancelledSubtitle,
        tone: "neutral",
      };
    default:
      // pending / waitlist: the request landed, the venue has not answered.
      // Saying "столик забронирован" here would be a promise we can't keep.
      return { title: t.booking.pendingTitle, subtitle: t.booking.pendingSubtitle, tone: "neutral" };
  }
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size: number; color: string; weight?: "regular" }>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Icon size={20} color={colors.text.muted} weight="regular" />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  stateRoot: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  heroTitle: {
    ...typography.titleLg,
    color: colors.text.primary,
    textAlign: "center",
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardTitle: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
  detailRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  // flex:1 so a long note or a long name wraps instead of overflowing at 360px.
  detailText: {
    flex: 1,
    gap: spacing.xxs,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  detailValue: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  freeCancel: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: "center",
  },
  notice: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  noticeText: {
    ...typography.body,
    color: colors.text.primary,
  },
  preorderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  preorderName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  preorderPrice: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  preorderTotalLabel: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  preorderTotalValue: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
});
