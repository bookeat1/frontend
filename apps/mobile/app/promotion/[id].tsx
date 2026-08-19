import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DetailInfoRow, detailStyles as styles } from "../../src/components/detail/DetailBlocks";
import { VenueContactsSection } from "../../src/components/detail/VenueContactsSection";
import { useExplorePromotion } from "../../src/components/explore/use-explore-data";
import { ArrowLeft, CalendarBlank, Export, Heart } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { PhotoRail } from "../../src/components/PhotoRail";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";
import { usePromoFavorite } from "../../src/hooks/useFavorites";
import { useRestaurant } from "../../src/hooks/useRestaurant";
import { formatDayMonth } from "../../src/lib/format";

const t = getDictionary();

/**
 * «Карточка акции» — one promotion's detail screen, built as the twin of the
 * event card (app/event/[id].tsx): the SAME blocks, from the same code —
 * `detailStyles` for the layout and `VenueContactsSection` for the contacts —
 * so a guest moving between афиша and акции sees one screen, not two.
 *
 * Раскладка макета 986:8940: серый фон экрана разделяет белые блоки —
 * «фото + название + подпись», «Об акции» со сроком действия и «Контакты»
 * заведения-хозяина. Под последним блоком белый «пол», чтобы оттягивание вниз
 * не показывало серое.
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
  // (and thus its restaurant id) is known. Same fetch the event card does: the
  // feed item carries only `restaurantId`/`restaurantName`, no contacts.
  const restaurantId = promo?.restaurantId;
  const { data: restaurant } = useRestaurant(restaurantId);

  // Сердечко сохраняет САМУ АКЦИЮ (`PUT|DELETE /promos/:id/favorite`).
  // Раньше вместо неё сохранялось заведение-хозяин: у акций своих избранных
  // не было, теперь есть.
  const favorite = usePromoFavorite(promo?.id);

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

  return (
    <View style={styles.root}>
      {header(
        <View style={styles.headerRightGroup}>
          <IconButton
            icon={Heart}
            accessibilityLabel={
              favorite.isFavorite
                ? t.restaurant.favoriteRemove(promo.title)
                : t.restaurant.favoriteAdd(promo.title)
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

      <ScrollView
        style={styles.scrollFloor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Фотография, название и подпись «Заведение · до 30 сентября» — ОДИН
            блок, как на карточке афиши: это ответ на вопрос «что за акция», и
            серый просвет посреди него делил бы ответ надвое.
            Cover first, then the gallery. The «−N%» badge stays pinned to the
            block rather than to a frame: it labels the PROMO, not one of its
            photos, so it must not swipe away with the first one. */}
        <View style={styles.summaryBlock}>
          <View style={styles.coverContainer}>
            <PhotoRail uris={[promo.coverImageUrl, ...promo.images]} />
            {promo.discountPercent !== null ? (
              <View style={promoStyles.badge}>
                <Text style={promoStyles.badgeText}>
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
        </View>

        {/* «Об акции» и срок действия — ОДИН блок, ровно как «Об афише» с датой
            на карточке афиши: срок это часть рассказа об акции, а не отдельная
            запись. Заголовок появляется только при описании (без текста ему
            нечего озаглавливать), сам блок — если есть хотя бы одно из двух. */}
        {promo.description || period ? (
          <View style={styles.section}>
            {promo.description ? (
              <>
                <Text style={styles.sectionTitle}>{t.promotions.aboutTitle}</Text>
                <Text style={styles.body}>{promo.description}</Text>
              </>
            ) : null}
            {period ? (
              <DetailInfoRow
                icon={CalendarBlank}
                primary={period}
                secondary={t.promotions.periodTitle}
              />
            ) : null}
          </View>
        ) : null}

        {/* Контакты — заведения-хозяина. Тот же компонент, что и на карточке
            афиши: он сам прячется, пока заведение не пришло или пока у него
            нет ни адреса, ни телефона, ни соцсетей. */}
        <VenueContactsSection restaurant={restaurant} />

        {/* Белый хвост под последним блоком. Это отдельный элемент, а не
            нижний отступ контейнера: отступ красился бы серым фоном списка,
            и под последней карточкой снова тянулась бы серая полоса. */}
        <View style={styles.bottomFloor} />
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

/** Единственное, что есть у акции и нет у афиши, — бейдж скидки. Остальная
 * раскладка живёт в `detailStyles`, общем с карточкой афиши. */
const promoStyles = StyleSheet.create({
  badge: {
    // Отступы считаются от края ФОТОГРАФИИ, а не блока: фото начинается на
    // 12 (поля блока) + 8 (внутренний отступ ленты), и бейдж отстоит от него
    // на те же 12, что и на карточке акции в списке.
    position: "absolute",
    top: spacing.md + spacing.md,
    left: spacing.md + spacing.sm + spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  badgeText: {
    ...typography.caption,
    color: colors.text.onBrand,
  },
});
