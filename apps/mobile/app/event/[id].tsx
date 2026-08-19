import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DetailInfoRow, detailStyles as styles } from "../../src/components/detail/DetailBlocks";
import { VenueContactsSection } from "../../src/components/detail/VenueContactsSection";
import { useExploreEvents, useEvent } from "../../src/components/explore/use-explore-data";
import { ArrowLeft, CalendarBlank, Export, Heart } from "../../src/components/icons";
import { IconButton } from "../../src/components/IconButton";
import { PhotoRail } from "../../src/components/PhotoRail";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";
import { TagChips } from "../../src/components/TagChips";
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
      {header(
        <View style={styles.headerRightGroup}>
          <IconButton
            icon={Heart}
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
            accessibilityLabel={t.a11y.shareButton}
            onPress={() => void share(event.title, venue)}
          />
        </View>,
      )}

      <ScrollView style={styles.scrollFloor}
            showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Cover first, then the gallery the venue uploaded beside it. With
            nothing but a cover the rail draws exactly the single photo this
            screen showed before. */}
        {/* Фотография и подпись под ней — ОДИН блок (макет 986:8940): это
            ответ на вопрос «что за событие», и серый просвет посреди него
            делил бы ответ надвое. */}
        <View style={styles.summaryBlock}>
          <PhotoRail uris={[event.coverImageUrl, ...event.images]} style={styles.coverContainer} />
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
        </View>

        {/* «Об афише» — hidden entirely when the venue wrote no description,
            rather than showing an empty heading. */}
        {/* Описание и дата — ОДИН блок «Об афише» (макет 986:8940): дата это
            часть рассказа о событии, а не отдельная запись. Блок появляется,
            если есть хотя бы одно из двух, и внутри каждая строка рисуется
            только когда она есть. */}
        {event.description || calendarLine ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.afisha.aboutTitle}</Text>
            {event.description ? <Text style={styles.body}>{event.description}</Text> : null}
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
