import { EMPTY_FILTERS, type PriceLevel, type SearchFilters } from "@bookeat/api";
import { colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { EmptyState, ErrorState, LoadingState } from "../src/components/StateViews";
import { FilterChip } from "../src/components/FilterChip";
import { RestaurantCard } from "../src/components/RestaurantCard";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { SearchBar } from "../src/components/SearchBar";
import { FilterButton } from "../src/components/search/FilterButton";
import { FilterSheet } from "../src/components/search/FilterSheet";
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
 *
 * Фильтры переехали из всегда-видимых рядов чипов в нижнюю шторку
 * (`FilterSheet`): под строкой поиска остаётся одна кнопка-ползунки со
 * счётчиком активных фильтров и ряд чипов ТОЛЬКО выбранных фасетов, каждый из
 * которых снимается тапом.
 */
export default function SearchScreen() {
  const router = useRouter();
  // Optional cuisine seed from the Home «Выберите кухню» chip. `useLocalSearchParams`
  // hands a string (or string[]), so narrow it to a single id.
  const { cuisine } = useLocalSearchParams<{ cuisine?: string }>();
  const initialCuisineId = Array.isArray(cuisine) ? cuisine[0] : cuisine;
  const {
    text,
    setText,
    filters,
    setFilters,
    uiFacets,
    setUiFacets,
    activeFilterCount,
    hasActiveSearch,
    isTyping,
    searchQueryResult,
    cuisinesQuery,
    citiesQuery,
  } = useSearchScreen({ initialCuisineId });

  const [sheetVisible, setSheetVisible] = useState(false);

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  const items = searchQueryResult.data?.items ?? [];

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setText("");
  };

  // Ряд под строкой поиска — только ВЫБРАННЫЕ поддерживаемые фильтры, каждый
  // снимается тапом. Кухни разворачиваем в человекочитаемые названия по
  // ответу запроса кухонь; если названия ещё не пришли, показываем сам id — но
  // не прячем чип, иначе выбранный фильтр становится невидимым.
  const cuisineNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cuisinesQuery.data ?? []) map.set(c.id, c.name);
    return map;
  }, [cuisinesQuery.data]);

  const selectedChips = useMemo(
    () => buildSelectedChips(filters, cuisineNameById),
    [filters, cuisineNameById],
  );

  return (
    <View style={styles.root}>
      <ScreenContainer padded={false}>
        <View style={styles.searchRow}>
          {/* Без autoFocus: экран теперь открывается со списком заведений, и
              клавиатура, накрывающая половину каталога сразу после «Смотреть
              все», мешает больше, чем помогает. */}
          <SearchBar value={text} onChangeText={setText} />

          {/* Кнопка фильтров + ряд выбранных чипов в одну строку. Ряд
              горизонтально прокручивается: на 360px три длинных названия кухонь
              иначе перенеслись бы на пол-экрана до результатов. */}
          <View style={styles.filterRow}>
            <FilterButton count={activeFilterCount} onPress={() => setSheetVisible(true)} />
            {selectedChips.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}
              >
                {selectedChips.map((chip) => (
                  <FilterChip
                    key={chip.key}
                    label={chip.label}
                    selected
                    selectedTone="brand"
                    // Тап по выбранному чипу снимает именно этот фильтр —
                    // применяется сразу, это уже поддержанный бэкендом фасет.
                    onPress={() => setFilters(chip.remove)}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
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

      <FilterSheet
        visible={sheetVisible}
        initialFilters={filters}
        initialUiFacets={uiFacets}
        cuisines={cuisinesQuery.data ?? []}
        cuisinesFailed={cuisinesQuery.isError}
        onRetryCuisines={() => cuisinesQuery.refetch()}
        cities={citiesQuery.data ?? []}
        onApply={(nextFilters, nextFacets) => {
          setFilters(nextFilters);
          setUiFacets(nextFacets);
          setSheetVisible(false);
        }}
        onClose={() => setSheetVisible(false)}
      />

      <BottomNavBar />
    </View>
  );
}

interface SelectedChip {
  key: string;
  label: string;
  /** Как выглядят фильтры после снятия этого чипа. */
  remove: (prev: SearchFilters) => SearchFilters;
}

/** Разворачивает применённые поддерживаемые фильтры в чипы «выбранного»: одна
 * запись на кухню + по одной на «открыто сейчас»/«бронь онлайн»/город/цену.
 * Повод и удобства сюда НЕ попадают — они выдачу не сужают (track-C). */
function buildSelectedChips(
  filters: SearchFilters,
  cuisineNameById: Map<string, string>,
): SelectedChip[] {
  const chips: SelectedChip[] = [];

  if (filters.openNowOnly) {
    chips.push({
      key: "openNow",
      label: t.search.filterOpenNow,
      remove: (prev) => ({ ...prev, openNowOnly: false }),
    });
  }
  if (filters.onlineBookableOnly) {
    chips.push({
      key: "onlineBookable",
      label: t.search.filterOnlineBookable,
      remove: (prev) => ({ ...prev, onlineBookableOnly: false }),
    });
  }
  if (filters.city !== undefined) {
    const city = filters.city;
    chips.push({
      key: "city",
      label: city,
      remove: (prev) => ({ ...prev, city: undefined }),
    });
  }
  if (filters.priceLevel !== undefined) {
    const priceLevel: PriceLevel = filters.priceLevel;
    chips.push({
      key: "price",
      label: priceLevel,
      remove: (prev) => ({ ...prev, priceLevel: undefined }),
    });
  }
  for (const id of filters.cuisineIds) {
    chips.push({
      key: `cuisine:${id}`,
      label: cuisineNameById.get(id) ?? id,
      remove: (prev) => ({ ...prev, cuisineIds: prev.cuisineIds.filter((x) => x !== id) }),
    });
  }

  return chips;
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
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
});
