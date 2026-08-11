import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPreview } from "../../src/components/booking/MapPreview";
import { useExploreEvents, useEvent } from "../../src/components/explore/use-explore-data";
import {
  ArrowLeft,
  CalendarBlank,
  Export,
  GlobeSimple,
  Heart,
  InstagramLogo,
  MapPin,
  Phone,
  WhatsappLogo,
} from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { PhotoView } from "../../src/components/PhotoView";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";
import { TagChips } from "../../src/components/TagChips";
import { useRestaurantFavorite } from "../../src/hooks/useFavorites";
import { useRestaurant } from "../../src/hooks/useRestaurant";
import { formatDateTime, formatDayMonth, formatTime } from "../../src/lib/format";

const t = getDictionary();

/**
 * «Карточка афиши» — one event's detail screen.
 *
 * The event is SELECTED out of the shared `/events` page (there is no
 * single-event endpoint — see `useEvent`), so arriving from the list or Home is
 * a cache hit. The «Контакты» block and the map belong to the event's HOST
 * venue, fetched with `useRestaurant(event.restaurant.id)` and rendered with
 * the very same pieces as the restaurant screen (social icons, contact rows,
 * MapPreview). The bottom CTA routes into the venue's booking flow — the exact
 * nav the restaurant screen uses.
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { event, isLoading, isError, refetch } = useEvent(id);
  const eventsQuery = useExploreEvents();

  // Host venue — for the contacts block and the map. Stays disabled until the
  // event (and thus its restaurant id) is known.
  const restaurantId = event?.restaurant.id;
  const { data: restaurant } = useRestaurant(restaurantId);

  // Same heart as the restaurant screen: a controlled favorite that writes to
  // the account (GET/POST /favorites). Events have no favorites of their own,
  // so "saving" one saves its venue — the only real backend, never a fake
  // local toggle. A signed-out guest is sent to sign-in by the hook.
  const favorite = useRestaurantFavorite(restaurantId ?? "");

  const share = async (title: string, venue: string) => {
    try {
      await Share.share({ message: t.restaurant.shareText(title, venue) });
    } catch {
      // Guest dismissed the sheet or the platform refused — not an error to report.
    }
  };

  const header = (right?: React.ReactNode) => (
    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
      <View style={styles.header}>
        <IconButton icon={ArrowLeft} accessibilityLabel={t.a11y.backButton} onPress={() => router.back()} />
        {right}
      </View>
    </SafeAreaView>
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        {header()}
        <LoadingState title={t.common.loading} />
      </View>
    );
  }

  // The /events request itself failed — offer a retry.
  if (isError) {
    return (
      <View style={styles.root}>
        {header()}
        <ErrorState
          title={t.explore.eventsErrorTitle}
          description={t.explore.eventsErrorDescription}
          action={{ label: t.common.retry, onPress: refetch, variant: "button" }}
        />
      </View>
    );
  }

  // Loaded, but this id is not in the page (finished, or a deep link beyond the
  // fetched window). Honest "not found", not an error — but let the guest pull
  // a fresh page in case it simply had not loaded.
  if (!event) {
    return (
      <View style={styles.root}>
        {header()}
        <EmptyState
          title={t.afisha.notFoundTitle}
          description={t.afisha.notFoundDescription}
          action={{
            label: t.common.retry,
            onPress: () => void eventsQuery.refetch(),
            variant: "button",
          }}
        />
      </View>
    );
  }

  const startsAt = new Date(event.startsAt);
  const dayMonth = Number.isNaN(startsAt.getTime()) ? "" : formatDayMonth(startsAt);
  const time = formatTime(event.startsAt);
  const venue = event.restaurant.name || event.venue;
  const subtitle = t.afisha.subtitle([venue, dayMonth, time]);
  const calendarLine = formatDateTime(event.startsAt);

  const hasContacts =
    restaurant &&
    Boolean(
      restaurant.social?.website ||
        restaurant.social?.whatsapp ||
        restaurant.social?.instagram ||
        restaurant.address ||
        restaurant.phone,
    );

  return (
    <View style={styles.root}>
      {header(
        <View style={styles.headerRightGroup}>
          <IconButton
            icon={Heart}
            accessibilityLabel={
              favorite.isFavorite
                ? t.restaurant.favoriteRemove(event.restaurant.name)
                : t.restaurant.favoriteAdd(event.restaurant.name)
            }
            selected={favorite.isFavorite}
            onPress={favorite.toggle}
          />
          <IconButton
            icon={Export}
            accessibilityLabel={t.a11y.shareButton}
            onPress={() => void share(event.title, venue)}
          />
        </View>,
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.coverContainer}>
          <PhotoView
            uri={event.coverImageUrl}
            style={styles.cover}
            transition={200}
            priority="high"
            placeholderIconSize={40}
            decorative
          />
        </View>

        <View style={styles.summary}>
          <Text style={styles.title}>{event.title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <TagChips tags={event.tags} />
          {favorite.failed ? (
            <Text style={styles.favoriteFailed} accessibilityRole="alert">
              {t.restaurant.favoriteFailed}
            </Text>
          ) : null}
        </View>

        {/* «Об афише» — hidden entirely when the venue wrote no description,
            rather than showing an empty heading. */}
        {event.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.afisha.aboutTitle}</Text>
            <Text style={styles.body}>{event.description}</Text>
          </View>
        ) : null}

        {calendarLine ? (
          <View style={styles.section}>
            <View style={styles.contactRow}>
              <CalendarBlank size={24} color={colors.text.primary} weight="regular" />
              <View style={styles.contactText}>
                <Text style={styles.contactPrimary}>{calendarLine}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Contacts belong to the host venue. Shown only once its data is in and
            only for fields that exist — a venue that answered with nothing gets
            no empty section. */}
        {hasContacts && restaurant ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.restaurant.contacts}</Text>

            {restaurant.social?.website || restaurant.social?.whatsapp || restaurant.social?.instagram ? (
              <View style={styles.socialRow}>
                {restaurant.social?.website ? (
                  <View style={styles.socialIcon}>
                    <GlobeSimple size={24} color={colors.text.primary} weight="regular" />
                  </View>
                ) : null}
                {restaurant.social?.whatsapp ? (
                  <View style={styles.socialIcon}>
                    <WhatsappLogo size={24} color={colors.text.primary} weight="regular" />
                  </View>
                ) : null}
                {restaurant.social?.instagram ? (
                  <View style={styles.socialIcon}>
                    <InstagramLogo size={24} color={colors.text.primary} weight="regular" />
                  </View>
                ) : null}
              </View>
            ) : null}

            {restaurant.address ? (
              <View style={styles.contactRow}>
                <MapPin size={24} color={colors.text.primary} weight="regular" />
                <View style={styles.contactText}>
                  <Text style={styles.contactPrimary}>{restaurant.address}</Text>
                  {restaurant.addressNote ? (
                    <Text style={styles.contactSecondary}>{restaurant.addressNote}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {restaurant.phone ? (
              <View style={styles.contactRow}>
                <Phone size={24} color={colors.text.primary} weight="regular" />
                <View style={styles.contactText}>
                  <Text style={styles.contactPrimary}>{restaurant.phone}</Text>
                  <Text style={styles.contactSecondary}>{t.restaurant.phoneLabel}</Text>
                </View>
              </View>
            ) : null}

            <MapPreview restaurant={restaurant} />
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
        <View style={styles.footer}>
          {/* Same booking flow the restaurant screen starts — routed with the
              event's host venue id. */}
          <PrimaryButton
            label={t.afisha.bookAction}
            onPress={() => router.push(`/restaurant/${event.restaurant.id}/book`)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Высота липкого футера с кнопкой (48 кнопка + 12 отступы сверху и снизу)
 * плюс воздух, чтобы последняя строка не липла к ней вплотную. */
const FOOTER_CLEARANCE = 48 + spacing.md * 2 + spacing.xxl;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: spacing.sm,
  },
  headerRightGroup: {
    flexDirection: "row",
  },
  scrollContent: {
    // Кнопка внизу — липкая и лежит НАД списком: без запаса в её высоту
    // последний блок (телефон и карта) остаётся под ней и до него не долистать.
    paddingBottom: FOOTER_CLEARANCE,
    gap: spacing.sm,
  },
  coverContainer: {
    padding: spacing.sm,
    backgroundColor: colors.background.surface,
  },
  cover: {
    width: "100%",
    height: 240,
    borderRadius: radius.photoHero,
    backgroundColor: colors.background.chip,
  },
  summary: {
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
  favoriteFailed: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  section: {
    backgroundColor: colors.background.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  body: {
    ...typography.body,
    color: colors.text.primary,
  },
  socialRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  socialIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.background.socialIcon,
    alignItems: "center",
    justifyContent: "center",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  contactText: {
    flex: 1,
  },
  contactPrimary: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  contactSecondary: {
    ...typography.caption,
    color: colors.text.muted,
  },
  footerSafeArea: {
    backgroundColor: colors.background.surface,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 16,
    elevation: 8,
  },
  footer: {
    padding: spacing.md,
  },
});
