import type { Restaurant, Weekday } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, Export, GlobeSimple, Heart, InstagramLogo, MapPin, Phone, WhatsappLogo, ArrowLeft } from "../../../src/components/icons";
import { IconButton } from "../../../src/components/IconButton";
import { MapPreview } from "../../../src/components/booking/MapPreview";
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
              {/* Адрес в каталоге бывает пустым — тогда строка не рисуется
                  вовсе, а не превращается в « · 3.4 км». */}
              {restaurant.address ? (
                <Text style={styles.addressLine}>
                  {restaurant.address}
                  {restaurant.distanceMeters !== undefined ? ` · ${distanceLabel(restaurant.distanceMeters)}` : ""}
                </Text>
              ) : null}
              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{todaysHoursLabel(restaurant)}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{restaurant.priceLevel}</Text>
                </View>
                {/* Рейтинг показываем только когда отзывы реально есть:
                    «0,0» у заведения без отзывов читается как плохая оценка. */}
                {restaurant.reviewsCount > 0 ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      {`${t.restaurant.rating(restaurant.rating)} · ${t.restaurant.reviewsCount(restaurant.reviewsCount)}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <SegmentedTabs
                labels={[t.restaurant.tabOverview, t.restaurant.tabPhotos]}
                // Вкладка «Фото» — это переход на отдельный экран, а не
                // переключение содержимого. Поэтому активной здесь всегда
                // остаётся «Обзор»: иначе после возврата назад подсветка
                // висела бы на «Фото», хотя на экране обзор.
                activeIndex={0}
                onChange={(index) => {
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
              {/* «Посмотреть меню» остаётся невключённой: экран меню сегодня
                  живёт внутри флоу бронирования и держит корзину предзаказа в
                  черновике этого флоу. Открыть его отсюда — значит дать гостю
                  набрать корзину, которая молча пропадёт при выходе. Нужен
                  отдельный экран меню вне флоу — отдельная задача. */}
              <PrimaryButton
                label={t.restaurant.viewMenu}
                variant="secondary"
                onPress={() => {}}
                disabled
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

              {/* Тот же блок карты, что и на экране брони: server-rendered
                  превью с тапом в приложение карт. Раньше здесь висела
                  картинка-заглушка с placehold.co и НАРИСОВАННАЯ булавка —
                  оба ушли: булавку рисует сам провайдер на настоящей карте,
                  вторая была бы вторым маркером не в том месте. */}
              <MapPreview restaurant={restaurant} />
            </View>
          </ScrollView>

          <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
            <View style={styles.footer}>
              <PrimaryButton
                label={restaurant.isBookable ? t.restaurant.bookTable : t.restaurant.bookingUnavailable}
                onPress={() => router.push(`/restaurant/${restaurant.id}/book`)}
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
  // У части заведений меню либо пустое, либо целиком без фотографий —
  // тогда честнее написать это, чем показать пустую полосу.
  if (items.length === 0) {
    return <Text style={styles.sectionEmpty}>{t.restaurant.menuEmpty}</Text>;
  }

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
  sectionEmpty: {
    ...typography.body,
    color: colors.text.muted,
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
  // Реальные адреса длинные («Проспект Аль-Фараби, 77/8. 1 этаж»); без flex
  // текст на 360 px уезжает за край вместо переноса.
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
