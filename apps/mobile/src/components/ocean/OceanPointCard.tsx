import type { RestaurantSummary } from "@bookeat/api";
import { colors, oceanPageLayout, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Fish, Gift } from "../icons";
import { PhotoView } from "../PhotoView";
import { oceanPointName } from "./ocean-basket-content";

const t = getDictionary();

/**
 * КАРТОЧКА ТОЧКИ Ocean Basket — макет 3z0f6dgev4HMwBAHPjTjPo, node 3441:12289:
 * фотография 215, номер точки в золотом кружке, пилюля «Welcome drink», белая
 * подложка с городом золотыми прописными и названием.
 *
 * ЭТО ЕДИНСТВЕННЫЙ ЖИВОЙ БЛОК СТРАНИЦЫ: заведение приходит из каталога
 * (`GET /restaurants/search`), фотография — его собственная, тап открывает его
 * экран. Всё остальное на странице зашито в код.
 *
 * ИМЯ РЕЖЕТСЯ: в каталоге «Ocean Basket Dostyk Plaza», в макете «Dostyk Plaza»
 * (node 3441:12293) — внутри страницы бренда имя бренда повторять незачем.
 * Правило одно и проверяется тестом (`oceanPointName`).
 *
 * ВЫСОТА НЕ ФИКСИРОВАНА, хотя в макете 291. Название приходит из данных и
 * бывает длиннее нарисованного: обрезать живое имя ради числа из макета
 * нельзя, поэтому 291 получается само на коротком имени, а длинное растит
 * карточку. В ленте карточки тянутся до высоты самой высокой.
 *
 * КРУЖОК С РЫБОЙ (node 3441:12300) — ДЕКОР, а не вторая кнопка: нажимается вся
 * карточка целиком. Две цели нажатия в одной карточке — это выбор, которого
 * гость не просил, и вторая цель для скринридера.
 */
export function OceanPointCard({
  venue,
  index,
  onPress,
}: {
  venue: RestaurantSummary;
  /** Порядковый номер точки в списке — из него берётся «01», «02», «03». */
  index: number;
  onPress: (restaurantId: string) => void;
}) {
  const name = oceanPointName(venue.name);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.openVenue(venue.name)}
      onPress={() => onPress(venue.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.photoSlot}>
        {/* Размер по умолчанию (`full`): карточка 292 pt — это 876 реальных
            точек на телефоне, и уменьшенная копия w640 была бы мылом. */}
        <PhotoView uri={venue.coverPhoto?.uri} style={styles.photo} decorative />
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{t.oceanBasket.pointNumber(index)}</Text>
        </View>
        {/* Пилюля «Welcome drink» — ЗАШИТЫЙ текст макета (node 3441:12296).
            Признака такой акции у заведения в API нет; это фирменная строка
            бренда, а не подтверждённое обещание конкретной точки. */}
        <View style={styles.tag}>
          <Gift size={13} color={colors.brand2.navyInk} weight="regular" />
          <Text style={styles.tagLabel} numberOfLines={1}>
            {t.oceanBasket.venueTag}
          </Text>
        </View>
        <View style={styles.fish}>
          <Fish size={15} color={colors.brand2.navyInk} weight="fill" />
        </View>
      </View>

      <View style={styles.body}>
        {venue.city ? (
          <Text style={styles.city} numberOfLines={1}>
            {venue.city.toLocaleUpperCase("ru-RU")}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: oceanPageLayout.venueCardWidth,
    borderRadius: oceanPageLayout.venueCardRadius,
    backgroundColor: colors.background.surface,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.85,
  },
  photoSlot: {
    height: oceanPageLayout.venueCardPhotoHeight,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    width: oceanPageLayout.venueBadgeSize,
    height: oceanPageLayout.venueBadgeSize,
    borderRadius: oceanPageLayout.venueBadgeSize / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand2.gold,
  },
  badgeLabel: {
    ...typography.brandVenueBadge,
    color: colors.brand2.navy,
  },
  tag: {
    position: "absolute",
    left: spacing.sm,
    // В макете пилюля стоит на 174 от верха карточки при фотографии 215 —
    // то есть в 11 от её нижнего края.
    bottom: 11,
    height: oceanPageLayout.venueTagHeight,
    borderRadius: oceanPageLayout.venueTagRadius,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.brand2.gold,
  },
  tagLabel: {
    ...typography.brandVenueTag,
    color: colors.brand2.navy,
  },
  fish: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    width: oceanPageLayout.venueFishButton,
    height: oceanPageLayout.venueFishButton,
    borderRadius: oceanPageLayout.venueFishButton / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.surface,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  city: {
    ...typography.brandVenueCity,
    color: colors.brand2.gold,
  },
  name: {
    ...typography.brandVenueName,
    color: colors.brand2.navy,
  },
});
