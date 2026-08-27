import { eventHero } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { EventHero } from "../../src/components/afisha/EventHero";
import { DetailInfoRow, detailStyles as styles } from "../../src/components/detail/DetailBlocks";
import { VenueContactsSection } from "../../src/components/detail/VenueContactsSection";
import { useExploreEvents, useEvent } from "../../src/components/explore/use-explore-data";
import { ArrowLeft, CalendarBlank, Export, Heart } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";
import { useEventFavorite } from "../../src/hooks/useFavorites";
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
  // Кнопки шапки лежат ПОВЕРХ фотографии, а не в отдельной белой полосе, —
  // значит их отступ сверху считаем сами от безопасной зоны устройства.
  const insets = useSafeAreaInsets();
  const { event, isLoading, isError, refetch } = useEvent(id);
  const eventsQuery = useExploreEvents();

  // Host venue — for the contacts block and the map. Stays disabled until the
  // event (and thus its restaurant id) is known.
  const restaurantId = event?.restaurant.id;
  const { data: restaurant } = useRestaurant(restaurantId);

  // Сердечко сохраняет САМО СОБЫТИЕ (`PUT|DELETE /events/:id/favorite`).
  // Раньше на его месте стояло избранное заведения-хозяина — «сохранить
  // событие» тихо сохраняло ресторан; у бэкенда своих избранных событий тогда
  // не было, теперь есть.
  //
  // Повторяющееся событие сохраняется целиком, СЕРИЕЙ: сервер сам превращает
  // id открытой даты в серию, а сравнение «сохранено ли» идёт по
  // recurrence_id — иначе сердечко было бы пустым на дате, отличной от той,
  // которую вернуло избранное.
  const favorite = useEventFavorite(event);

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

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scrollFloor}
            showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Фотография, название, подпись и метки — ОДИН кадр (макет 986:8940,
            узел «Hero / Editorial» 3452:13224): подпись лежит ПОВЕРХ
            фотографии, а кнопки шапки — на ней же. */}
        <EventHero
          photos={[event.coverImageUrl, ...event.images]}
          title={event.title}
          subtitle={subtitle}
          tags={event.tags}
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
                    ? t.restaurant.favoriteRemove(event.title)
                    : t.restaurant.favoriteAdd(event.title)
                }
                selected={favorite.isFavorite}
                onPress={favorite.toggle}
              />
              <IconButton
                icon={Export}
                tone="onPhotoLight"
                size={eventHero.controlSize}
                accessibilityLabel={t.a11y.shareButton}
                onPress={() => void share(event.title, venue)}
              />
            </>
          }
        />
        {/* Сообщение о неудавшемся сохранении — отдельным белым блоком: на
            кадре ему места нет, а `summary` (подпись под фотографией) в этом
            макете больше не рисуется. */}
        {favorite.failed ? (
          <View style={styles.section}>
            <Text style={styles.favoriteFailed} accessibilityRole="alert">
              {t.restaurant.favoriteFailed}
            </Text>
          </View>
        ) : null}

        {/* «Об афише» — hidden entirely when the venue wrote no description,
            rather than showing an empty heading. */}
        {/* Описание и дата — ОДИН блок «Об афише» (макет 986:8940): дата это
            часть рассказа о событии, а не отдельная запись. Блок появляется,
            если есть хотя бы одно из двух, и внутри каждая строка рисуется
            только когда она есть. */}
        {event.description || calendarLine ? (
          <View style={[styles.section, styles.sectionSpread]}>
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionTitle}>{t.afisha.aboutTitle}</Text>
              {event.description ? <Text style={styles.body}>{event.description}</Text> : null}
            </View>
            {calendarLine ? <DetailInfoRow icon={CalendarBlank} primary={calendarLine} /> : null}
          </View>
        ) : null}

        {/* Контакты — заведения-хозяина. Общий с карточкой акции блок: он сам
            прячется, пока заведение не пришло или пока у него нет контактов. */}
        <VenueContactsSection restaurant={restaurant} />

        {/* Белый хвост под последним блоком. Это отдельный элемент, а не
            нижний отступ контейнера: отступ красился бы серым фоном списка,
            и под последней карточкой снова тянулась бы серая полоса. */}
        <View style={styles.bottomFloor} />
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
