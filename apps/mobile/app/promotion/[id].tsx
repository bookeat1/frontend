import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPreview } from "../../src/components/booking/MapPreview";
import { useExplorePromotion } from "../../src/components/explore/use-explore-data";
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
import { useRestaurantFavorite } from "../../src/hooks/useFavorites";
import { useRestaurant } from "../../src/hooks/useRestaurant";
import { formatDayMonth } from "../../src/lib/format";

const t = getDictionary();

/**
 * «Карточка акции» — one promotion's detail screen, built as the twin of the
 * event card (app/event/[id].tsx): same header, same cover, same «Контакты»
 * block and map of the host venue, same bottom CTA into that venue's booking
 * flow. A guest moving between афиша and акции sees one screen, not two.
 *
 * The promo is SELECTED out of the shared city feed — this backend has no
 * single-promo endpoint — so arriving from the list or from Home is a cache
 * hit, and a promo that has dropped out of the feed resolves to "not found"
 * rather than to an error.
 */
export default function PromotionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { promo, query } = useExplorePromotion(id);

  // Host venue — for the contacts block and the map. Disabled until the promo
  // (and thus its restaurant id) is known.
  const restaurantId = promo?.restaurantId;
  const { data: restaurant } = useRestaurant(restaurantId);

  // Promos have no favourites of their own, so the heart saves the VENUE —
  // the same controlled favorite the restaurant and event screens use.
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
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t.a11y.backButton}
          onPress={() => router.back()}
        />
        {right}
      </View>
    </SafeAreaView>
  );

  if (query.isLoading) {
    return (
      <View style={styles.root}>
        {header()}
        <LoadingState title={t.promotions.loading} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.root}>
        {header()}
        <ErrorState
          title={t.promotions.errorTitle}
          description={t.promotions.errorDescription}
          action={{ label: t.common.retry, onPress: () => void query.refetch(), variant: "button" }}
        />
      </View>
    );
  }

  if (!promo) {
    return (
      <View style={styles.root}>
        {header()}
        <EmptyState
          title={t.promotions.notFoundTitle}
          description={t.promotions.notFoundDescription}
          action={{
            label: t.common.retry,
            onPress: () => void query.refetch(),
            variant: "button",
          }}
        />
      </View>
    );
  }

  const venue = promo.restaurantName.trim();
  const startsAt = new Date(promo.startsAt);
  const endsAt = new Date(promo.endsAt);
  const from = Number.isNaN(startsAt.getTime()) ? "" : formatDayMonth(startsAt);
  const to = Number.isNaN(endsAt.getTime()) ? "" : formatDayMonth(endsAt);
  const until = to ? t.promotions.until(to) : "";
  const subtitle = t.promotions.subtitle([venue, until]);
  // Both ends known — show the window; only the end — the «до …» line already
  // in the subtitle is enough, so the period row stays out.
  const period = from && to ? t.promotions.period(from, to) : "";

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
                ? t.restaurant.favoriteRemove(venue)
                : t.restaurant.favoriteAdd(venue)
            }
            selected={favorite.isFavorite}
            onPress={favorite.toggle}
          />
          <IconButton
            icon={Export}
            accessibilityLabel={t.a11y.shareButton}
            onPress={() => void share(promo.title, venue)}
          />
        </View>,
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.coverContainer}>
          <PhotoView
            uri={promo.coverImageUrl ?? undefined}
            style={styles.cover}
            transition={200}
            priority="high"
            placeholderIconSize={40}
            decorative
          />
          {promo.discountPercent !== null ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {t.explore.promoDiscount(promo.discountPercent)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.summary}>
          <Text style={styles.title}>{promo.title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {favorite.failed ? (
            <Text style={styles.favoriteFailed} accessibilityRole="alert">
              {t.restaurant.favoriteFailed}
            </Text>
          ) : null}
        </View>

        {/* Hidden entirely when the venue wrote no description, rather than
            showing an empty heading. */}
        {promo.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.promotions.aboutTitle}</Text>
            <Text style={styles.body}>{promo.description}</Text>
          </View>
        ) : null}

        {period ? (
          <View style={styles.section}>
            <View style={styles.contactRow}>
              <CalendarBlank size={24} color={colors.text.primary} weight="regular" />
              <View style={styles.contactText}>
                <Text style={styles.contactPrimary}>{period}</Text>
                <Text style={styles.contactSecondary}>{t.promotions.periodTitle}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {hasContacts && restaurant ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.restaurant.contacts}</Text>

            {restaurant.social?.website ||
            restaurant.social?.whatsapp ||
            restaurant.social?.instagram ? (
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

      {/* No host venue on record (the feed can omit `restaurant_id`) — then
          there is no booking flow to route into, and a button that navigates
          to `/restaurant//book` is worse than no button. */}
      {promo.restaurantId ? (
        <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
          <View style={styles.footer}>
            <PrimaryButton
              label={t.promotions.bookAction}
              onPress={() => router.push(`/restaurant/${promo.restaurantId}/book`)}
            />
          </View>
        </SafeAreaView>
      ) : null}
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
  badge: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  badgeText: {
    ...typography.caption,
    color: colors.text.onBrand,
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
