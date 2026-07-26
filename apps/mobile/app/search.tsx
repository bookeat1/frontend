import { EMPTY_FILTERS, type PriceLevel } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { FilterChip } from "../src/components/FilterChip";
import { RestaurantCard } from "../src/components/RestaurantCard";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { SearchBar } from "../src/components/SearchBar";
import { useSearchScreen } from "../src/hooks/useSearch";

const t = getDictionary();

/**
 * Каталог с поиском и фильтрами. Раньше это был экран `/` — он переехал сюда
 * без изменений, когда домашним экраном стал Explore (`app/index.tsx`), а
 * поисковая строка на нём стала кнопкой, ведущей на этот маршрут.
 *
 * Пустой запрос показывает ВЕСЬ каталог, а не заглушку: на этот экран ведут
 * и вкладка «Поиск», и «Смотреть все» с главного, и оба раза гость приходил в
 * пустоту с тремя выдуманными подсказками. Список заведений при пустой строке
 * — это ответ сервера на `GET /restaurants/search` без `q`.
 */

/** Ценовые ступени, которые понимает бэкенд (price_category «₸»/«₸₸»/«₸₸₸»).
 * Четвёртой ступени в каталоге нет, поэтому фильтр её и не предлагает. */
const PRICE_FILTERS: PriceLevel[] = ["₸", "₸₸", "₸₸₸"];

export default function SearchScreen() {
  const router = useRouter();
  const {
    text,
    setText,
    filters,
    setFilters,
    hasActiveSearch,
    isTyping,
    searchQueryResult,
    cuisinesQuery,
    citiesQuery,
  } = useSearchScreen();

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  const toggleOpenNow = () =>
    setFilters((prev) => ({ ...prev, openNowOnly: !prev.openNowOnly }));

  const toggleOnlineBookable = () =>
    setFilters((prev) => ({ ...prev, onlineBookableOnly: !prev.onlineBookableOnly }));

  const toggleCuisine = (cuisineId: string) =>
    setFilters((prev) => ({
      ...prev,
      cuisineIds: prev.cuisineIds.includes(cuisineId)
        ? prev.cuisineIds.filter((id) => id !== cuisineId)
        : [...prev.cuisineIds, cuisineId],
    }));

  // Город и цена — одиночный выбор: бэкенд сравнивает их на равенство, а
  // повторное нажатие по выбранному чипу снимает фильтр.
  const toggleCity = (city: string) =>
    setFilters((prev) => ({ ...prev, city: prev.city === city ? undefined : city }));

  const togglePrice = (priceLevel: PriceLevel) =>
    setFilters((prev) => ({
      ...prev,
      priceLevel: prev.priceLevel === priceLevel ? undefined : priceLevel,
    }));

  /**
   * Сколько из показанных заведений реально можно забронировать в приложении.
   * Считается по загруженной странице (весь каталог приходит одной: per_page
   * 100 против 24 заведений), поэтому число честное, а не «из первых
   * двадцати». Строка не показывается, когда бронировать можно везде, — и
   * когда фильтр «бронь онлайн» уже включён, потому что тогда она тавтология.
   */
  const items = searchQueryResult.data?.items ?? [];
  const bookableCount = items.filter((item) => item.acceptsOnlineBookings).length;
  const bookableNote =
    filters.onlineBookableOnly || items.length === 0 || bookableCount === items.length
      ? null
      : bookableCount === 0
        ? t.search.onlineBookableNone
        : t.search.onlineBookableCount(bookableCount, items.length);

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setText("");
  };

  return (
    <View style={styles.root}>
      <ScreenContainer padded={false}>
        <View style={styles.searchRow}>
          {/* Без autoFocus: экран теперь открывается со списком заведений, и
              клавиатура, накрывающая половину каталога сразу после «Смотреть
              все», мешает больше, чем помогает. */}
          <SearchBar value={text} onChangeText={setText} />

          {/* Два прокручиваемых ряда вместо одного переносящегося: на 360 px
              список кухонь иначе занимает пол-экрана до результатов. */}
          <ChipRow>
            <FilterChip
              label={t.search.filterOpenNow}
              selected={filters.openNowOnly}
              onPress={toggleOpenNow}
            />
            {/* Выключен по умолчанию: каталог показывает ВСЕ заведения, в том
                числе те, куда нужно звонить. Это выход для гостя, который
                хочет забронировать прямо сейчас, а не способ спрятать
                неудобные строки. */}
            <FilterChip
              label={t.search.filterOnlineBookable}
              selected={filters.onlineBookableOnly}
              onPress={toggleOnlineBookable}
            />
            {(citiesQuery.data ?? []).map((city) => (
              <FilterChip
                key={city}
                label={city}
                selected={filters.city === city}
                onPress={() => toggleCity(city)}
              />
            ))}
            {PRICE_FILTERS.map((priceLevel) => (
              <FilterChip
                key={priceLevel}
                label={priceLevel}
                selected={filters.priceLevel === priceLevel}
                onPress={() => togglePrice(priceLevel)}
              />
            ))}
          </ChipRow>

          <ChipRow>
            {cuisinesQuery.isError ? (
              // Кухни грузятся отдельным запросом: если он упал, показываем
              // именно это, а не пустой ряд, который выглядит как «кухонь нет».
              <FilterChip
                label={t.search.filterCuisinesFailed}
                selected={false}
                onPress={() => cuisinesQuery.refetch()}
              />
            ) : (
              (cuisinesQuery.data ?? []).map((cuisine) => (
                <FilterChip
                  key={cuisine.id}
                  label={cuisine.name}
                  selected={filters.cuisineIds.includes(cuisine.id)}
                  onPress={() => toggleCuisine(cuisine.id)}
                />
              ))
            )}
          </ChipRow>
        </View>

        {isTyping || searchQueryResult.isPending ? (
          <LoadingState title={t.search.loadingTitle} />
        ) : searchQueryResult.isError ? (
          <ErrorState
            title={t.search.errorTitle}
            description={t.search.errorDescription}
            retryLabel={t.common.retry}
            onRetry={() => searchQueryResult.refetch()}
          />
        ) : items.length === 0 ? (
          // Пустой каталог и «по этому запросу ничего нет» — разные вещи, и
          // предлагать «сбросить фильтры» там, где фильтров нет, бессмысленно.
          hasActiveSearch ? (
            <EmptyState
              title={t.search.emptyTitle}
              description={t.search.emptyDescription}
              actionLabel={t.search.emptyResetFilters}
              onAction={resetFilters}
            />
          ) : (
            <EmptyState
              title={t.search.catalogEmptyTitle}
              description={t.search.catalogEmptyDescription}
            />
          )
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RestaurantCard restaurant={item} onPress={openRestaurant} />
            )}
            // Заголовок списка — счётчик реальных результатов, он же объясняет
            // при пустом запросе, что перед гостем весь каталог. Вторая строка
            // появляется, когда часть заведений онлайн-бронь не принимает: без
            // неё каталог читается как стена карточек, ведущих в никуда.
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Text style={styles.resultsCount}>
                  {t.search.resultsCount(searchQueryResult.data?.total ?? 0)}
                </Text>
                {bookableNote ? (
                  <Text style={styles.bookableNote}>{bookableNote}</Text>
                ) : null}
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: spacing.xxl }} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // 24 заведения сегодня и до 100 на страницу — список должен
            // оставаться оконным, а не монтировать все карточки с фото сразу.
            initialNumToRender={6}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </ScreenContainer>

      <BottomNavBar />
    </View>
  );
}

/** Горизонтальный ряд чипов фильтра. Пустой ряд не занимает высоту. */
function ChipRow({ children }: { children: React.ReactNode }) {
  if (React.Children.count(children) === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.chipsRow}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  searchRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  listHeader: {
    gap: spacing.xxs,
    paddingBottom: spacing.md,
  },
  resultsCount: {
    ...typography.caption,
    color: colors.text.muted,
  },
  bookableNote: {
    ...typography.caption,
    color: colors.text.mutedStrong,
  },
});
