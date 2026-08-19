import type { FavoriteEvent, FavoriteItem, FavoritePromo, RestaurantSummary } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { DataErrorState } from "../src/components/DataErrorState";
import { FavoriteMediaCard } from "../src/components/favorites/FavoriteMediaCard";
import { FavoriteButton } from "../src/components/explore/FavoriteButton";
import { FilterChip } from "../src/components/FilterChip";
import { FlowHeader } from "../src/components/FlowHeader";
import { Heart } from "../src/components/icons";
import { RestaurantCard } from "../src/components/RestaurantCard";
import { EmptyState, LoadingState } from "../src/components/StateViews";
import {
  useEventFavorite,
  useFavoriteItems,
  usePromoFavorite,
  useRestaurantFavorite,
} from "../src/hooks/useFavorites";
import { useAuth } from "../src/lib/auth";
import {
  favoriteItemKey,
  favoriteTabCount,
  FAVORITE_TABS,
  filterFavoriteItems,
  type FavoriteTab,
} from "../src/lib/favorites-tabs";
import { formatDayMonth, formatTime } from "../src/lib/format";

const t = getDictionary();

/**
 * «Избранные» — всё, что гость сохранил: рестораны, события и акции
 * (`GET /favorites/items`), макет 602:3630.
 *
 * ОДИН запрос на весь экран, без `type=`: сервер считает `counts` по всем
 * видам сразу, поэтому чипы со счётчиками и содержимое любой вкладки берутся
 * из одного и того же ответа, а переключение вкладки — это фильтр в памяти, а
 * не новый запрос и не новый спиннер.
 *
 * Строки заведений — обычная каталожная `RestaurantCard` (вторая, чуть другая
 * карточка заведения была бы дефектом); события и акции — общая
 * `FavoriteMediaCard`.
 *
 * Списка нет на сервере постранично: эндпоинт отдаёт весь набор одним массивом,
 * параметра страницы нет. Избранное гостя по природе небольшое; если это
 * перестанет быть правдой, нужна серверная страница, а не клиентская обрезка,
 * которая прячет строки.
 */
export default function FavoritesScreen() {
  const navPad = useNavBarSpacing();
  const router = useRouter();
  const { status } = useAuth();
  const query = useFavoriteItems();
  const [tab, setTab] = useState<FavoriteTab>("all");

  const items = useMemo(
    () => filterFavoriteItems(query.data?.items ?? [], tab),
    [query.data, tab],
  );

  const renderItem = useCallback(({ item }: { item: FavoriteItem }) => <Row item={item} />, []);

  const body = () => {
    if (status === "loading") return <LoadingState title={t.favorites.loadingTitle} />;
    if (status === "signed-out") {
      return (
        <EmptyState
          icon={Heart}
          title={t.favorites.signedOutTitle}
          description={t.favorites.signedOutDescription}
          action={{
            label: t.favorites.signIn,
            onPress: () => router.push("/auth/sign-in"),
            variant: "button",
          }}
        />
      );
    }
    if (query.isPending) return <LoadingState title={t.favorites.loadingTitle} />;
    if (query.isError) {
      return <DataErrorState error={query.error} onRetry={() => void query.refetch()} />;
    }

    return (
      <>
        <View style={styles.chipsRow}>
          {FAVORITE_TABS.map((value) => (
            <FilterChip
              key={value}
              label={t.favorites.tabWithCount(
                tabLabel(value),
                favoriteTabCount(query.data.counts, value),
              )}
              selected={tab === value}
              size="roomy"
              onPress={() => setTab(value)}
            />
          ))}
        </View>

        {items.length === 0 ? (
          // Пустая вкладка говорит именно про свой вид: гость без сохранённых
          // событий не должен читать текст про рестораны.
          <EmptyState icon={Heart} title={emptyTitle(tab)} description={emptyDescription(tab)} />
        ) : (
          <FlatList
            // Список — второй ребёнок колонки (над ним ряд чипов), поэтому ему
            // нужен свой flex: иначе он вырастает по содержимому и уезжает под
            // нижнюю навигацию вместо того, чтобы прокручиваться.
            style={styles.listFlex}
            data={items}
            keyExtractor={favoriteItemKey}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={[styles.list, { paddingBottom: navPad }]}
            showsVerticalScrollIndicator={false}
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        )}
      </>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.favorites.title} />
      </SafeAreaView>

      <View style={styles.body}>{body()}</View>

      <BottomNavBar />
    </View>
  );
}

function tabLabel(tab: FavoriteTab): string {
  switch (tab) {
    case "all":
      return t.favorites.tabAll;
    case "restaurant":
      return t.favorites.tabRestaurants;
    case "event":
      return t.favorites.tabEvents;
    case "promo":
      return t.favorites.tabPromos;
  }
}

function emptyTitle(tab: FavoriteTab): string {
  switch (tab) {
    case "all":
      return t.favorites.emptyTitle;
    case "restaurant":
      return t.favorites.emptyRestaurantsTitle;
    case "event":
      return t.favorites.emptyEventsTitle;
    case "promo":
      return t.favorites.emptyPromosTitle;
  }
}

function emptyDescription(tab: FavoriteTab): string {
  switch (tab) {
    case "all":
      return t.favorites.emptyDescription;
    case "restaurant":
      return t.favorites.emptyRestaurantsDescription;
    case "event":
      return t.favorites.emptyEventsDescription;
    case "promo":
      return t.favorites.emptyPromosDescription;
  }
}

/** Одна строка списка. Каждый вид — свой компонент, потому что у каждого свой
 * хук сердечка, а хук нельзя звать условно. */
function Row({ item }: { item: FavoriteItem }) {
  switch (item.kind) {
    case "restaurant":
      return <RestaurantRow restaurant={item.restaurant} />;
    case "event":
      return <EventRow event={item.event} />;
    case "promo":
      return <PromoRow promo={item.promo} />;
  }
}

function RestaurantRow({ restaurant }: { restaurant: RestaurantSummary }) {
  const router = useRouter();
  const favorite = useRestaurantFavorite(restaurant.id);

  return (
    <View>
      <RestaurantCard
        restaurant={restaurant}
        onPress={(id) => router.push(`/restaurant/${id}`)}
        photoOverlay={
          <FavoriteButton
            itemName={restaurant.name}
            isFavorite={favorite.isFavorite}
            onToggle={favorite.toggle}
          />
        }
      />
      {favorite.failed ? <ToggleFailed /> : null}
    </View>
  );
}

function EventRow({ event }: { event: FavoriteEvent }) {
  const router = useRouter();
  const favorite = useEventFavorite(event);
  const startsAt = new Date(event.startsAt);
  // «16 мая · 13:00» — та же сборка подписи, что и в афише; части, которых
  // нет, выпадают вместе со своими точками.
  const meta = t.afisha.subtitle([
    Number.isNaN(startsAt.getTime()) ? "" : formatDayMonth(startsAt),
    formatTime(event.startsAt),
  ]);

  return (
    <View>
      <FavoriteMediaCard
        title={event.title}
        meta={meta}
        coverImageUrl={event.coverImageUrl}
        tags={event.tags}
        favorite={{ isFavorite: favorite.isFavorite, onToggle: favorite.toggle }}
        onPress={() => router.push(`/event/${event.id}`)}
        accessibilityLabel={t.afisha.card(event.title, meta, event.restaurantName)}
      />
      {favorite.failed ? <ToggleFailed /> : null}
    </View>
  );
}

function PromoRow({ promo }: { promo: FavoritePromo }) {
  const router = useRouter();
  const favorite = usePromoFavorite(promo.id);
  const endsAt = new Date(promo.endsAt);
  const meta = Number.isNaN(endsAt.getTime()) ? "" : t.promotions.until(formatDayMonth(endsAt));

  return (
    <View>
      <FavoriteMediaCard
        title={promo.title}
        meta={meta}
        coverImageUrl={promo.coverImageUrl}
        badge={
          promo.discountPercent !== null ? t.explore.promoDiscount(promo.discountPercent) : undefined
        }
        favorite={{ isFavorite: favorite.isFavorite, onToggle: favorite.toggle }}
        onPress={() => router.push(`/promotion/${promo.id}`)}
        accessibilityLabel={t.promotions.card(promo.title, promo.restaurantName)}
      />
      {favorite.failed ? <ToggleFailed /> : null}
    </View>
  );
}

/** Сердечко уже вернулось в прежнее состояние — строка объясняет, почему. */
function ToggleFailed() {
  return (
    <Text style={styles.toggleFailed} accessibilityRole="alert">
      {t.favorites.toggleFailed}
    </Text>
  );
}

/** Ритм между карточками — 40 по макету. */
function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  body: {
    flex: 1,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // Зазор 6 из макета; в шкале spacing такого шага нет.
    gap: spacing.xs + 2,
  },
  listFlex: {
    flex: 1,
  },
  list: {
    // Карточки сами отступают от краёв (фото 8, текст 16), поэтому у списка
    // горизонтальных отступов нет — иначе они сложились бы.
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  separator: {
    height: spacing.huge,
  },
  toggleFailed: {
    ...typography.caption,
    color: colors.brand.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
});
