import { EMPTY_FILTERS, type PriceLevel, type SearchFilters } from "@bookeat/api";
import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { DataErrorState } from "../src/components/DataErrorState";
import { MagnifyingGlass } from "../src/components/icons";
import { EmptyState, LoadingState } from "../src/components/StateViews";
import { FilterChip } from "../src/components/FilterChip";
import { FavoriteRestaurantCard } from "../src/components/FavoriteRestaurantCard";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { SearchBar } from "../src/components/SearchBar";
import { FilterButton } from "../src/components/search/FilterButton";
import { FilterSheet } from "../src/components/search/FilterSheet";
import { useSearchScreen } from "../src/hooks/useSearch";
import { MAX_GUESTS } from "../src/lib/availability-options";
import { toDateKey } from "../src/lib/format";

const t = getDictionary();

/** Сколько чипов «Часто ищут» показываем максимум. */
/**
 * Разбирает выбор, пришедший с главной. Дата и гости применяются ТОЛЬКО парой
 * (сервер игнорирует одно без другого), поэтому недостающая половина берёт
 * значение по умолчанию, а не оставляет фильтр наполовину собранным.
 *
 * Мусор в параметрах — не повод падать: приходит он из ссылки, а не из нашего
 * кода, и «непонятный параметр» должен означать «фильтра нет», а не пустой
 * экран.
 */
function availabilityFromParams(
  guests: string | string[] | undefined,
  date: string | string[] | undefined,
): SearchFilters["availability"] {
  const rawGuests = Array.isArray(guests) ? guests[0] : guests;
  const rawDate = Array.isArray(date) ? date[0] : date;
  if (!rawGuests && !rawDate) return undefined;
  const n = Number(rawGuests);
  if (!Number.isInteger(n) || n < 1 || n > MAX_GUESTS) return undefined;
  const day = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toDateKey(new Date());
  return { date: day, guests: n };
}

const FREQUENT_CUISINE_LIMIT = 8;

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
  const navPad = useNavBarSpacing();
  const router = useRouter();
  // Optional cuisine seed from the Home «Выберите кухню» chip. `useLocalSearchParams`
  // hands a string (or string[]), so narrow it to a single id.
  // Капсула на главной ведёт сюда и приносит свой выбор: /search?guests=2.
  // Дата необязательна — с главной приходит «сегодня», если её не выбирали.
  const { cuisine, guests, date } = useLocalSearchParams<{
    cuisine?: string;
    guests?: string;
    date?: string;
  }>();
  const initialCuisineId = Array.isArray(cuisine) ? cuisine[0] : cuisine;
  const initialAvailability = useMemo(
    () => availabilityFromParams(guests, date),
    [guests, date],
  );
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
  } = useSearchScreen({ initialCuisineId, initialAvailability });

  const [sheetVisible, setSheetVisible] = useState(false);
  // Подсказки «Часто ищут» живут по фокусу поля, а не по пустой строке: гость
  // видит их в тот момент, когда собирается искать, а не всё время, пока просто
  // листает каталог.
  const [searchFocused, setSearchFocused] = useState(false);

  // Прячет подсказки вместе с клавиатурой. `Keyboard.dismiss` нужен потому,
  // что onBlur сам по себе не сработает: поле остаётся сфокусированным, пока
  // клавиатуру не убрали.
  const dismissSuggestions = useCallback(() => {
    setSearchFocused(false);
    Keyboard.dismiss();
  }, []);

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

  // «Часто ищут»: короткий ряд быстрых чипов из РЕАЛЬНЫХ кухонь каталога.
  // У `Cuisine` нет поля популярности/счётчика (это {id, name}, собранный
  // дедупом ответа /restaurants/search и отсортированный по названию), поэтому
  // сортировать не по чему — берём первые FREQUENT_CUISINE_LIMIT в том порядке,
  // как их вернул запрос. id — это casefold(cuisine_type), ровно та форма, на
  // которую матчит фильтр (cuisineIdFor), так что чип сразу сузит выдачу и
  // всплывёт в ряду выбранных. Пусто/грузится/ошибка — не рисуем ничего: блок
  // необязательный, скелет и ошибка здесь были бы шумом.
  const frequentCuisines = useMemo(
    () => (cuisinesQuery.data ?? []).slice(0, FREQUENT_CUISINE_LIMIT),
    [cuisinesQuery.data],
  );

  // Показываем ровно в момент намерения искать: гость тапнул в поле, но ещё
  // ничего не набрал и не выбрал фильтр. Начал печатать — подсказки уходят,
  // чтобы не спорить с выдачей; просто листает каталог, не трогая поле, — их
  // тоже нет (раньше блок висел всё время, пока строка пуста, и занимал три
  // строки над результатами).
  const showFrequent =
    searchFocused &&
    text.trim().length === 0 &&
    activeFilterCount === 0 &&
    frequentCuisines.length > 0;

  const applyCuisine = useCallback(
    (id: string) =>
      setFilters((prev) =>
        prev.cuisineIds.includes(id)
          ? prev
          : { ...prev, cuisineIds: [...prev.cuisineIds, id] },
      ),
    [setFilters],
  );

  return (
    <View style={styles.root}>
      <ScreenContainer padded={false}>
        <View style={styles.searchRow}>
          {/* Без autoFocus: экран теперь открывается со списком заведений, и
              клавиатура, накрывающая половину каталога сразу после «Смотреть
              все», мешает больше, чем помогает. */}
          <SearchBar
            value={text}
            onChangeText={setText}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />

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

        {showFrequent ? (
          <View style={styles.frequentBlock}>
            <Text style={styles.frequentTitle}>{t.search.frequentTitle}</Text>
            {/* Список строк с лупой, как в макете (node 347:5561), а не ряд
                чипов: подсказка читается как «поисковый запрос, который можно
                повторить», и восемь длинных русских названий кухонь больше не
                занимают три ряда над выдачей. */}
            {frequentCuisines.map((cuisine) => (
              <Pressable
                key={cuisine.id}
                accessibilityRole="button"
                accessibilityLabel={t.explore.cuisineFilter(cuisine.name)}
                onPress={() => applyCuisine(cuisine.id)}
                style={({ pressed }) => [styles.frequentRow, pressed && styles.frequentRowPressed]}
              >
                <MagnifyingGlass size={20} color={colors.text.mutedStrong} weight="regular" />
                <Text style={styles.frequentLabel} numberOfLines={1}>
                  {cuisine.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {isTyping || searchQueryResult.isPending ? (
          <LoadingState title={t.search.loadingTitle} />
        ) : searchQueryResult.isError ? (
          <DataErrorState
            error={searchQueryResult.error}
            onRetry={() => void searchQueryResult.refetch()}
          />
        ) : items.length === 0 ? (
          // Три разных пустых состояния (Figma «Состояния»): текстовый ЗАПРОС
          // без результатов, активный ФИЛЬТР без результатов (со ссылкой
          // «Сбросить фильтры»), и просто пустой каталог — сбрасывать в нём
          // нечего. Запрос приоритетнее фильтра: если гость печатал, показываем
          // «По запросу «…»».
          text.trim().length > 0 ? (
            <EmptyState
              icon={MagnifyingGlass}
              title={t.search.emptyTitle}
              description={t.search.emptyQueryDescription(text.trim())}
            />
          ) : hasActiveSearch ? (
            <EmptyState
              icon={MagnifyingGlass}
              title={t.search.emptyTitle}
              description={t.search.emptyFilterDescription(
                selectedChips[0]?.label ?? "",
              )}
              action={{
                label: t.search.emptyResetFilters,
                onPress: resetFilters,
                variant: "link",
              }}
            />
          ) : (
            <EmptyState
              icon={MagnifyingGlass}
              title={t.search.catalogEmptyTitle}
              description={t.search.catalogEmptyDescription}
            />
          )
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FavoriteRestaurantCard restaurant={item} onPress={openRestaurant} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.xxl }} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: navPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Гость потянул список — он уже смотрит выдачу, а не собирается
            // искать: убираем клавиатуру и подсказки, чтобы они не занимали
            // три строки над результатами, которые он листает.
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissSuggestions}
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
  frequentBlock: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  frequentTitle: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
    marginBottom: spacing.xs,
  },
  frequentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    // 44 — минимальная зона нажатия; строка подсказки должна попадаться пальцем
    // так же уверенно, как чип до неё.
    minHeight: hitSlop.minTouchTarget,
  },
  frequentRowPressed: {
    opacity: 0.6,
  },
  frequentLabel: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1,
  },
});
