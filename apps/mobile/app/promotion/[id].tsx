import { eventHero } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { EventHero } from "../../src/components/afisha/EventHero";
import { DetailInfoRow, detailStyles as styles } from "../../src/components/detail/DetailBlocks";
import { VenueContactsSection } from "../../src/components/detail/VenueContactsSection";
import { useExplorePromotion } from "../../src/components/explore/use-explore-data";
import { ArrowLeft, CalendarBlank, Export, Heart } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";
import { usePromoFavorite } from "../../src/hooks/useFavorites";
import { useRestaurant } from "../../src/hooks/useRestaurant";
import { formatDayMonth } from "../../src/lib/format";

const t = getDictionary();

/**
 * «Карточка акции» — one promotion's detail screen, built as the twin of the
 * event card (app/event/[id].tsx): the SAME blocks, from the same code —
 * `EventHero` for the header, `detailStyles` for the layout and
 * `VenueContactsSection` for the contacts — so a guest moving between афиша и
 * акции sees one screen, not two.
 *
 * ПЕРЕСОБРАНА ПО ОБРАЗЦУ АФИШИ 2026-08-28 (правка владельца: «карточка акции
 * должна быть такой же, как афиша и карточка заведения, по структуре»). Было:
 * фотография в белой рамке с полями 12, под ней на белом название и подпись, а
 * стрелка назад, сердечко и «поделиться» — в отдельной белой полосе сверху.
 * Стало ровно то же, что у афиши и у статьи:
 *
 *   • фотография 350 ВО ВСЮ ШИРИНУ, название и подпись ПОВЕРХ неё в нижнем
 *     углу, градиент-затемнение под текстом;
 *   • три плавающие круглые кнопки НА кадре: «назад» слева, сердечко и
 *     «поделиться» справа;
 *   • дальше без изменений — те же белые блоки `detailStyles` с просветом 8,
 *     «Об акции», «Контакты», белый «пол» и липкий футер.
 *
 * ЧЕГО У АКЦИИ НЕТ ПО ДАННЫМ (и потому нет на кадре):
 *   • МЕТОК — у афиши это `event.tags`, у акции такого поля в ленте нет вовсе;
 *   • ВРЕМЕНИ — у афиши `startsAt` с часом начала, у акции это срок кампании,
 *     и он остаётся строкой «до 30 сентября» в подписи и рядом «Период» ниже.
 *
 * ЧЕГО НЕТ У АФИШИ, А У АКЦИИ ЕСТЬ: размер скидки. Он уходит в кадр отдельным
 * пропом `badge` — фирменной плашкой, ровно как на карточке акции в списке, а
 * не серой пилюлей в ряду меток.
 *
 * The promo is SELECTED out of the shared city feed — this backend has no
 * single-promo endpoint — so arriving from the list or from Home is a cache
 * hit, and a promo that has dropped out of the feed resolves to "not found"
 * rather than to an error.
 */
export default function PromotionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Кнопки шапки лежат ПОВЕРХ фотографии, а не в отдельной белой полосе, —
  // значит их отступ сверху считаем сами от безопасной зоны устройства.
  const insets = useSafeAreaInsets();
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

  // Шапка веток «загружаем / не найдено / ошибка» — та же белая полоса со
  // стрелкой, что у афиши и у статьи: фотографии и названия там ещё нет, и
  // рисовать кадр не на чем.
  const plainHeader = () => (
    <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
      <View style={styles.header}>
        <IconButton
          icon={ArrowLeft}
          accessibilityLabel={t.a11y.backButton}
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );

  if (query.isLoading) {
    return (
      <View style={styles.root}>
        {plainHeader()}
        <LoadingState title={t.promotions.loading} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.root}>
        {plainHeader()}
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
        {plainHeader()}
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
      <ScrollView
        style={styles.scrollFloor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Фотография, название и подпись «Заведение · до 30 сентября» — ОДИН
            кадр, тот же `EventHero`, что у афиши и у статьи. Лента фотографий
            сохранена: у акции сверх обложки бывает галерея. */}
        <EventHero
          photos={[promo.coverImageUrl, ...promo.images]}
          title={promo.title}
          subtitle={subtitle}
          // Меток у акции нет — поля под них в ленте не существует.
          tags={[]}
          // Единственное, чего нет у афиши: размер скидки. Плашка привязана к
          // КАДРУ, а не к первой фотографии, — она про акцию целиком и не
          // должна улистываться вместе со снимком.
          badge={
            promo.discountPercent !== null
              ? t.explore.promoDiscount(promo.discountPercent)
              : undefined
          }
          topInset={insets.top}
          backButton={
            <IconButton
              icon={ArrowLeft}
              tone="onPhotoLight"
              size={eventHero.controlSize}
              accessibilityLabel={t.a11y.backButton}
              onPress={() => router.back()}
            />
          }
          actions={
            <>
              <IconButton
                icon={Heart}
                tone="onPhotoLight"
                size={eventHero.controlSize}
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
                tone="onPhotoLight"
                size={eventHero.controlSize}
                accessibilityLabel={t.a11y.shareButton}
                onPress={() => void share(promo.title, venue)}
              />
            </>
          }
        />

        {/* Сообщение о неудавшемся сохранении — отдельным белым блоком, как на
            афише: на кадре ему места нет. */}
        {favorite.failed ? (
          <View style={styles.section}>
            <Text style={styles.favoriteFailed} accessibilityRole="alert">
              {t.restaurant.favoriteFailed}
            </Text>
          </View>
        ) : null}

        {/* «Об акции» и срок действия — ОДИН блок, ровно как «Об афише» с датой
            на карточке афиши: срок это часть рассказа об акции, а не отдельная
            запись. Заголовок появляется только при описании (без текста ему
            нечего озаглавливать), сам блок — если есть хотя бы одно из двух. */}
        {promo.description || period ? (
          <View style={[styles.section, styles.sectionSpread]}>
            {promo.description ? (
              <View style={styles.sectionGroup}>
                <Text style={styles.sectionTitle}>{t.promotions.aboutTitle}</Text>
                <Text style={styles.body}>{promo.description}</Text>
              </View>
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
