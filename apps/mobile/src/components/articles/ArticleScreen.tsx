import { RepositoryError, type GuideCollectionDetail } from "@bookeat/api";
import { colors, eventHero, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import type { UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { EventHero } from "../afisha/EventHero";
import { detailStyles } from "../detail/DetailBlocks";
import { ArrowLeft, Export } from "../icons";
import { IconButton } from "../IconButton";
import { PrimaryButton } from "../PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../StateViews";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { GuideVenueBlock } from "./GuideVenueBlock";

const t = getDictionary();

/**
 * КАРТОЧКА СТАТЬИ — `/articles/:slug`, ручка `GET /articles/:slug`.
 *
 * СОБРАНА ПО ОБРАЗЦУ КАРТОЧКИ АФИШИ (`app/event/[id].tsx`, правка владельца
 * 28.08.2026). До этого статья делила верстку с подборкой гастрогида
 * (`GuideCollectionScreen`): кремовый лист, тёмно-синяя шапка с градиентом,
 * Cormorant Garamond у заголовков. Гость ходит между афишей и статьёй, и две
 * разные типографики читались как два разных приложения.
 *
 * Что взято у афиши БУКВАЛЬНО — те же компоненты, а не похожие копии:
 *  • `EventHero` — фотография 350 во всю ширину, название и подпись ПОВЕРХ неё
 *    в нижнем углу, градиент-затемнение под текстом;
 *  • плавающие круглые кнопки на кадре: «назад» слева, «поделиться» справа,
 *    те же `IconButton` с `tone="onPhotoLight"` и размером `eventHero`;
 *  • `detailStyles` — серый лист-разделитель, белые блоки с просветом 8,
 *    заголовки блоков `titleLg`, текст `body`, белый «пол» под последним
 *    блоком и липкий футер с кнопкой.
 *
 * ЧЕГО У СТАТЬИ НЕТ ПО ДАННЫМ (и потому нет на экране):
 *  • ГАЛЕРЕИ — у детальной ручки одна обложка `coverImageUrl`, а у афиши
 *    `coverImageUrl + images[]`. `EventHero` получает массив из одного кадра и
 *    сам рисует его без листания;
 *  • МЕТОК на фотографии — у афиши это `event.tags`, у статьи такого поля нет
 *    вовсе. Подставлять сюда слаги рубрик нельзя: у статей их нет;
 *  • СЕРДЕЧКА — избранное на бэкенде знает про заведения, события и акции, но
 *    не про статьи. Инертное сердечко из этого приложения уже убирали;
 *  • ДАТЫ — у афиши строка `startsAt`, у статьи ни даты события, ни даты
 *    публикации в ответе нет;
 *  • КНОПКИ «Забронировать столик» — бронировать статью не у кого. На её месте
 *    в том же липком футере стоит «Посмотреть заведения» — единственное
 *    действие, которое у статьи есть.
 *
 * ЧЕГО НЕТ У АФИШИ, А У СТАТЬИ ЕСТЬ: список заведений (`venues[]`) — блок
 * «Все точки» со счётчиком, теми же карточками `GuideVenueBlock`, что и на
 * странице подборки. Это материал, ради которого статью открывают.
 *
 * Страница ПОДБОРКИ гастрогида (`/gastroguide/collections/:slug`) осталась на
 * `GuideCollectionScreen` — у неё свой брендовый макет, и он не менялся.
 *
 * Состояния прежние: неизвестный слаг — 404 и честное «не найдено» (повтор
 * ничего не изменит), любой другой отказ — ошибка с кнопкой «Повторить».
 */
export function ArticleScreen({ query }: { query: UseQueryResult<GuideCollectionDetail> }) {
  const router = useRouter();
  // Кнопки шапки лежат ПОВЕРХ фотографии, а не в белой полосе, — отступ
  // сверху считаем сами от безопасной зоны устройства (как на афише).
  const insets = useSafeAreaInsets();
  const article = query.data;

  const { refreshing, onRefresh } = usePullToRefresh(() => query.refetch());

  const openRestaurant = useCallback(
    (restaurantId: string) => router.push(`/restaurant/${restaurantId}`),
    [router],
  );

  const notFound =
    query.isError && query.error instanceof RepositoryError && query.error.isNotFound;

  const share = async (title: string) => {
    try {
      await Share.share({ message: `${title} — ${t.explore.articleAuthorDefault}` });
    } catch {
      // Гость закрыл шторку или система отказала — не ошибка, о которой стоит
      // сообщать.
    }
  };

  // Шапка веток «загружаем / не найдено / ошибка» — ровно та же белая полоса
  // со стрелкой, что у афиши: фотографии и названия там ещё нет, и рисовать
  // кадр не на чем.
  const plainHeader = () => (
    <SafeAreaView edges={["top"]} style={detailStyles.headerSafeArea}>
      <View style={detailStyles.header}>
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
      <View style={detailStyles.root}>
        {plainHeader()}
        <LoadingState title={t.articles.loading} />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={detailStyles.root}>
        {plainHeader()}
        <EmptyState title={t.articles.notFoundTitle} description={t.articles.notFoundDescription} />
      </View>
    );
  }

  if (query.isError || !article) {
    return (
      <View style={detailStyles.root}>
        {plainHeader()}
        <ErrorState
          title={t.articles.errorTitle}
          description={t.articles.errorDescription}
          action={{ label: t.common.retry, onPress: () => query.refetch(), variant: "button" }}
        />
      </View>
    );
  }

  return (
    <View style={detailStyles.root}>
      <ScrollView
        style={detailStyles.scrollFloor}
        contentContainerStyle={detailStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <EventHero
          // Одна обложка вместо ленты: галереи у статьи в ответе нет.
          photos={[article.coverImageUrl]}
          title={article.title}
          subtitle={article.subtitle}
          // Меток у статьи нет — ряд пилюль просто не рисуется.
          tags={[]}
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
            <IconButton
              icon={Export}
              tone="onPhotoLight"
              size={eventHero.controlSize}
              accessibilityLabel={t.a11y.shareButton}
              onPress={() => void share(article.title)}
            />
          }
        />

        {/* «О статье» — на месте блока «Об афише». Блока нет вовсе, если
            редакция не написала текст: пустой заголовок хуже его отсутствия. */}
        {article.description ? (
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>{t.articles.articleAboutTitle}</Text>
            <Text style={detailStyles.body}>{article.description}</Text>
          </View>
        ) : null}

        {article.venues.length > 0 ? (
          <View style={[detailStyles.section, detailStyles.sectionSpread]}>
            <View style={styles.sectionHeader}>
              <Text style={detailStyles.sectionTitle}>{t.articles.allPointsTitle}</Text>
              {/* Счётчик считается по ФАКТИЧЕСКИ пришедшим блокам, а не по
                  `venueCount`: у списочной формы это число могло устареть, а
                  гость видит именно карточки. */}
              <Text style={styles.sectionCount}>{t.articles.venueCount(article.venues.length)}</Text>
            </View>
            <View style={styles.venues}>
              {article.venues.map((venue) => (
                <GuideVenueBlock key={venue.restaurantId} venue={venue} onPress={openRestaurant} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Белый «пол» под последним блоком — тот же приём, что на афише:
            оттягивание снизу не должно показывать серую полосу. */}
        <View style={detailStyles.bottomFloor} />
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={detailStyles.footerSafeArea}>
        <View style={detailStyles.footer}>
          {/* На месте «Забронировать столик» с афиши: у статьи бронировать
              нечего, и единственное её действие — уйти в каталог. */}
          <PrimaryButton label={t.articles.browseVenues} onPress={() => router.push("/search")} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xl,
  },
  sectionCount: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: "right",
  },
  venues: {
    gap: spacing.lg,
  },
});
