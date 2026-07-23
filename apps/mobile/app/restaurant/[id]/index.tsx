import type { Restaurant, Weekday } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, Export, GlobeSimple, Heart, InstagramLogo, MapPin, Phone, WhatsappLogo, ArrowLeft } from "../../../src/components/icons";
import { IconButton } from "../../../src/components/IconButton";
import { MenuItemCard } from "../../../src/components/MenuItemCard";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { PromoBannerStrip } from "../../../src/components/PromoBannerStrip";
import { SegmentedTabs } from "../../../src/components/SegmentedTabs";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { useRestaurant } from "../../../src/hooks/useRestaurant";

const t = getDictionary();

const WEEKDAY_ORDER: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function todaysHoursLabel(restaurant: Restaurant): string {
  const today = WEEKDAY_ORDER[new Date().getDay()];
  const entry = restaurant.workingHours.find((h) => h.weekday === today);
  if (!entry || !entry.opensAt || !entry.closesAt) {
    return restaurant.isOpenNow ? t.restaurant.openNow : t.restaurant.closedNow;
  }
  return restaurant.isOpenNow
    ? t.restaurant.closesAt(entry.closesAt)
    : t.restaurant.opensAt(entry.opensAt);
}

function distanceLabel(meters: number): string {
  return meters < 1000 ? `${meters} м` : `${(meters / 1000).toFixed(1)} км`;
}

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: restaurant, isLoading, isError, refetch } = useRestaurant(id);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <View style={styles.root}>
      {isLoading ? (
        <SafeAreaView style={styles.loadingSafeArea}>
          <LoadingState title={t.common.loading} />
        </SafeAreaView>
      ) : isError || !restaurant ? (
        <SafeAreaView style={styles.loadingSafeArea}>
          <ErrorState
            title={t.search.errorTitle}
            description={t.search.errorDescription}
            retryLabel={t.common.retry}
            onRetry={() => refetch()}
          />
        </SafeAreaView>
      ) : (
        <>
          <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
            <View style={styles.header}>
              <IconButton icon={ArrowLeft} accessibilityLabel={t.a11y.backButton} onPress={() => router.back()} />
              <View style={styles.headerRightGroup}>
                <IconButton icon={Heart} accessibilityLabel={t.a11y.favoriteButton} onPress={() => {}} />
                <IconButton icon={Export} accessibilityLabel={t.a11y.shareButton} onPress={() => {}} />
              </View>
            </View>
          </SafeAreaView>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.coverContainer}>
              <Image
                source={{ uri: restaurant.coverPhoto.uri }}
                style={styles.cover}
                contentFit="cover"
                accessibilityLabel={restaurant.coverPhoto.alt}
                transition={200}
              />
            </View>

            <View style={styles.summary}>
              <Text style={styles.name}>{restaurant.name}</Text>
              <Text style={styles.addressLine}>
                {restaurant.address}
                {restaurant.distanceMeters !== undefined ? ` · ${distanceLabel(restaurant.distanceMeters)}` : ""}
              </Text>
              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{todaysHoursLabel(restaurant)}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{restaurant.priceLevel}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <SegmentedTabs
                labels={[t.restaurant.tabOverview, t.restaurant.tabPhotos]}
                activeIndex={activeTab}
                onChange={(index) => {
                  setActiveTab(index);
                  if (index === 1) router.push(`/restaurant/${restaurant.id}/photos`);
                }}
              />

              <PromoBannerStrip banners={restaurant.promoBanners} />

              <View style={styles.textBlock}>
                <Text style={styles.sectionTitle}>{t.restaurant.about}</Text>
                <Text style={styles.description}>{restaurant.description}</Text>
              </View>

              <View style={styles.hoursRow}>
                <Clock size={24} color={colors.text.primary} weight="regular" />
                <View>
                  <Text style={styles.hoursPrimary}>{todaysHoursLabel(restaurant)}</Text>
                  <Text style={styles.hoursSecondary}>
                    {(() => {
                      const first = restaurant.workingHours.find((h) => h.opensAt && h.closesAt);
                      return first ? t.restaurant.everydayHours(first.opensAt!, first.closesAt!) : "";
                    })()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.restaurant.menuHighlights}</Text>
              <ScrollableMenu items={restaurant.menuHighlights} />
              <PrimaryButton
                label={t.restaurant.viewMenu}
                variant="secondary"
                onPress={() => {}}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.restaurant.contacts}</Text>
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

              <View style={styles.contactRow}>
                <MapPin size={24} color={colors.text.primary} weight="regular" />
                <View>
                  <Text style={styles.contactPrimary}>{restaurant.address}</Text>
                  {restaurant.addressNote ? (
                    <Text style={styles.contactSecondary}>{restaurant.addressNote}</Text>
                  ) : null}
                </View>
              </View>

              {restaurant.phone ? (
                <View style={styles.contactRow}>
                  <Phone size={24} color={colors.text.primary} weight="regular" />
                  <View>
                    <Text style={styles.contactPrimary}>{restaurant.phone}</Text>
                    <Text style={styles.contactSecondary}>{t.restaurant.phoneLabel}</Text>
                  </View>
                </View>
              ) : null}

              {restaurant.mapImage ? (
                <View style={styles.mapContainer}>
                  <Image
                    source={{ uri: restaurant.mapImage.uri }}
                    style={styles.mapImage}
                    contentFit="cover"
                    accessibilityLabel={restaurant.mapImage.alt}
                  />
                  <View pointerEvents="none" style={styles.mapPin} />
                </View>
              ) : null}
            </View>
          </ScrollView>

          <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
            <View style={styles.footer}>
              <PrimaryButton
                label={restaurant.isBookable ? t.restaurant.bookTable : t.restaurant.bookingUnavailable}
                onPress={() => {}}
                disabled={!restaurant.isBookable}
              />
            </View>
          </SafeAreaView>
        </>
      )}
    </View>
  );
}

function ScrollableMenu({ items }: { items: Restaurant["menuHighlights"] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.menuRow}>
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  loadingSafeArea: {
    flex: 1,
    backgroundColor: colors.background.surface,
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
    paddingBottom: spacing.xxxl,
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
    gap: spacing.lg,
  },
  name: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  addressLine: {
    ...typography.body,
    color: colors.text.primary,
    marginTop: spacing.xxs,
  },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.background.chip,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  section: {
    backgroundColor: colors.background.surface,
    padding: spacing.lg,
    gap: spacing.xxl,
  },
  textBlock: {
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  description: {
    ...typography.body,
    color: colors.text.primary,
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  hoursPrimary: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  hoursSecondary: {
    ...typography.caption,
    color: colors.text.muted,
  },
  menuRow: {
    flexDirection: "row",
    gap: spacing.sm,
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
  contactPrimary: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  contactSecondary: {
    ...typography.caption,
    color: colors.text.muted,
  },
  mapContainer: {
    height: 208,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  mapImage: {
    ...StyleSheet.absoluteFill,
  },
  mapPin: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -20,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 10,
    borderColor: colors.brand.primary,
    backgroundColor: colors.background.surface,
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
