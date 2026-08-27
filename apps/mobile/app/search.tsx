import { EMPTY_FILTERS, type PriceLevel, type SearchFilters, type TimeOfDay } from "@bookeat/api";
import { colors, listCard, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { DataErrorState } from "../src/components/DataErrorState";
import { MagnifyingGlass } from "../src/components/icons";
import { EmptyState, LoadingState } from "../src/components/StateViews";
import { FilterChip } from "../src/components/FilterChip";
import { FavoriteRestaurantCard } from "../src/components/FavoriteRestaurantCard";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { SearchBar } from "../src/components/SearchBar";
import {
  AvailabilityWheels,
  type AvailabilityHalf,
} from "../src/components/search/AvailabilityWheels";
import { FilterButton } from "../src/components/search/FilterButton";
import { FilterSheet } from "../src/components/search/FilterSheet";
import { usePullToRefresh } from "../src/hooks/usePullToRefresh";
import { useSearchScreen } from "../src/hooks/useSearch";
import { dateChoices } from "../src/lib/availability-label";
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
  // Кухонь в ссылке может быть несколько — через запятую, теми же кодами, что
  // уходят серверу (`/search?cuisine=european,kazakh`). Разбираем и список, и
  // повторяющийся параметр, потому что expo-router отдаёт `string[]`, если он
  // встретился дважды. Пустые куски выкидываем: «european,,» это одна кухня, а
  // не две, и пустой чип-фильтр гость снять не сможет.
  const initialCuisineIds = useMemo(
    () =>
      (Array.isArray(cuisine) ? cuisine : [cuisine])
        .flatMap((value) => (value ?? "").split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    [cuisine],
  );
  const initialAvailability = useMemo(
    () => availabilityFromParams(guests, date),
    [guests, date],
  );
  const {
    text,
    setText,
    filters,
    setFilters,
    activeFilterCount,
    hasActiveSearch,
    isTyping,
    searchQueryResult,
    cuisinesQuery,
    amenitiesQuery,
    citiesQuery,
  } = useSearchScreen({ initialCuisineIds, initialAvailability });

  // Шторка фильтров ВСЕГДА открывается только по кнопке-ползункам.
  //
  // Раньше переход с главной мог раскрыть её сразу (параметр маршрута `focus`,
  // 24.08). Убрано 26.08 по правке владельца: панель фильтров нагружена, и
  // встречать ею человека, который всего лишь назвал день и компанию, — значит
  // пугать его на первом же шаге. День и компанию он теперь выбирает шторкой с
  // колесом ПРЯМО НА ГЛАВНОЙ и приходит сюда к готовой выдаче: параметры
  // `date`/`guests` уже применены (см. `availabilityFromParams`), панель
  // закрыта.
  const [sheetVisible, setSheetVisible] = useState(false);
  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);
  // Какая половина подбора раскрыта колесом ПРЯМО ИЗ РЯДА чипов, без шторки
  // фильтров. Колёса те же (`AvailabilityWheels`), что внутри шторки, и
  // правило «наружу только парой» лежит в них, а не здесь.
  const [availabilityPicker, setAvailabilityPicker] = useState<AvailabilityHalf | null>(null);

  // Гость потянул выдачу — он уже смотрит результаты, а не набирает запрос:
  // клавиатура уходит. Своего состояния фокуса у экрана больше нет — чипы
  // быстрого поиска видны сразу, а не по тапу в поле (макет 918:12539).
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  const items = searchQueryResult.data?.items ?? [];

  // Потянуть выдачу = переспросить ЕЁ, с теми же строкой и фильтрами.
  // Справочники (кухни, удобства, города) при этом не трогаем: они питают
  // шторку, живут одним кэшем на всё приложение и меняются раз в месяц —
  // жест здесь про свежесть ВЫДАЧИ.
  //
  // Со сплошным экраном загрузки кружок не встречается: пока данные уже есть,
  // `isPending` ложно, и перезапрос не возвращает экран в состояние
  // «Загружаем» — ветка остаётся списком, а состояние жеста показывает
  // именно кружок.
  const { refreshing, onRefresh } = usePullToRefresh(() => searchQueryResult.refetch());

  const resetFilters = () => {
    // Один источник — `filters`: всё, что рисует чипы, лежит здесь, поэтому
    // сброс не может «забыть» половину ряда, как это было, пока часть выбора
    // жила отдельной сумкой UI-фасетов.
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

  // Названия удобств — из того же справочника, что рисует галочки в шторке.
  // Своих подписей у приложения нет: они бы разошлись с кабинетом.
  const amenityNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of amenitiesQuery.data ?? []) map.set(a.id, a.name);
    return map;
  }, [amenitiesQuery.data]);

  // Подпись выбранного дня — тот же расчёт, что и в капсуле внутри шторки.
  // «Сегодня» пересчитывать в течение сессии не нужно: экран живёт минуты, а
  // не сутки.
  const dateLabelFor = useMemo(() => dateChoices(new Date()).labelFor, []);

  const selectedChips = useMemo(
    () => buildSelectedChips(filters, cuisineNameById, amenityNameById, dateLabelFor),
    [filters, cuisineNameById, amenityNameById, dateLabelFor],
  );

  // Снятие чипа применяется СРАЗУ, без открытия шторки: новый запрос уходит
  // сам, потому что `filters` — часть queryKey.
  const removeChip = useCallback(
    (chip: RemovableChip) => setFilters(chip.removeFilters),
    [setFilters],
  );

  // Колесо, поднятое чипом подбора, применяется целиком: `AvailabilityWheels`
  // отдаёт готовую пару, и «дата без гостей» тут физически не собирается.
  const changeAvailability = useCallback(
    (next: SearchFilters["availability"]) => setFilters((prev) => ({ ...prev, availability: next })),
    [setFilters],
  );

  // «Часто ищут»: короткий ряд быстрых подсказок из СПРАВОЧНИКА кухонь.
  // Поля популярности у кухни нет, зато есть `display_order` — порядок,
  // который расставила платформа; сервер уже отдал список в нём, поэтому
  // берём первые FREQUENT_CUISINE_LIMIT как есть, ничего не пересортировывая.
  // Значение — код справочника, ровно та форма, на которую матчит фильтр, так
  // что подсказка сразу сузит выдачу и всплывёт в ряду выбранных. Пусто/грузится/ошибка — не рисуем ничего: блок
  // необязательный, скелет и ошибка здесь были бы шумом.
  const frequentCuisines = useMemo(
    () => (cuisinesQuery.data ?? []).slice(0, FREQUENT_CUISINE_LIMIT),
    [cuisinesQuery.data],
  );

  // Чипы быстрого поиска видны СРАЗУ, как только искать нечего: строка пуста
  // и ни один фильтр не выбран (правка владельца 2026-08-27, макет 918:12539
  // — «Pizza / Kazakh cuisine / Georgian cuisine» стоят в ряду под строкой
  // поиска с первого кадра). Раньше блок появлялся только по фокусу поля и
  // висел ОТДЕЛЬНЫМ вертикальным списком с лупами над выдачей.
  //
  // Как только гость начал печатать или выбрал фильтр, ряд занимают чипы
  // ВЫБРАННОГО: два разных смысла в одном ряду одновременно (подсказка и
  // применённый фильтр) невозможно различить глазами — оба серые пилюли.
  const showFrequent =
    text.trim().length === 0 && activeFilterCount === 0 && frequentCuisines.length > 0;

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
          <SearchBar value={text} onChangeText={setText} />

          {/* Кнопка фильтров + ряд чипов в одну строку (макет 918:12561).
              Пока искать нечего, в ряду стоят чипы БЫСТРОГО ПОИСКА; как только
              что-то выбрано — чипы применённых фильтров. Ряд горизонтально
              прокручивается: на 360px три длинных названия кухонь иначе
              перенеслись бы на пол-экрана до результатов. */}
          <View style={styles.filterRow}>
            <FilterButton count={activeFilterCount} onPress={openSheet} />
            {showFrequent ? (
              // Чипы быстрого поиска. Значение чипа — код кухни из
              // справочника, ровно та форма, на которую матчит фильтр, так что
              // тап сразу сужает выдачу, а сам чип тут же сменяется чипом
              // выбранного фильтра — с крестиком «снять».
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}
              >
                {frequentCuisines.map((cuisine) => (
                  <FilterChip
                    key={cuisine.id}
                    label={cuisine.name}
                    accessibilityLabel={t.explore.cuisineFilter(cuisine.name)}
                    onPress={() => applyCuisine(cuisine.id)}
                  />
                ))}
              </ScrollView>
            ) : selectedChips.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}
              >
                {selectedChips.map((chip) =>
                  // Два вида чипов, и вид виден по стрелке справа. Со стрелкой
                  // — дата и гости: тап МЕНЯЕТ выбор, поднимая то же колесо,
                  // что на главной и в шторке. С крестиком — все остальные:
                  // тап СНИМАЕТ фильтр.
                  chip.kind === "availability" ? (
                    <FilterChip
                      key={chip.key}
                      label={chip.label}
                      chevron
                      accessibilityLabel={`${chip.sectionTitle}: ${chip.label}`}
                      onPress={() => setAvailabilityPicker(chip.half)}
                    />
                  ) : (
                    <FilterChip
                      key={chip.key}
                      label={chip.label}
                      // Без `selected`: в узле 347:5942 чипы этого ряда серые с
                      // тёмной подписью. Сплошная заливка тут ничего не
                      // различала — в ряду по определению только применённые
                      // фильтры, и «выделять» их не от чего; активность
                      // показывает крестик «снять».
                      // Тап по чипу и тап по крестику — одно и то же действие:
                      // снять именно этот фильтр и сразу переспросить сервер.
                      onPress={() => removeChip(chip)}
                      onRemove={() => removeChip(chip)}
                      removeAccessibilityLabel={t.a11y.removeFilter(chip.label)}
                    />
                  ),
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>

        {isTyping || searchQueryResult.isPending ? (
          <LoadingState title={t.search.loadingTitle} />
        ) : searchQueryResult.isError ? (
          <DataErrorState
            error={searchQueryResult.error}
            onRetry={() => void searchQueryResult.refetch()}
          />
        ) : items.length === 0 ? (
          // Пустую выдачу тоже можно потянуть: «может, уже появилось» — это
          // тот же жест, и лента с `flexGrow: 1` даёт его короткому
          // содержимому.
          // Три разных пустых состояния (Figma «Состояния»): текстовый ЗАПРОС
          // без результатов, активный ФИЛЬТР без результатов (со ссылкой
          // «Сбросить фильтры»), и просто пустой каталог — сбрасывать в нём
          // нечего. Запрос приоритетнее фильтра: если гость печатал, показываем
          // «По запросу «…»».
          <ScrollView
            contentContainerStyle={[styles.stateContent, { paddingBottom: navPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {text.trim().length > 0 ? (
              <EmptyState
                icon={MagnifyingGlass}
                title={t.search.emptyTitle}
                description={t.search.emptyQueryDescription(text.trim())}
              />
            ) : hasActiveSearch ? (
              <EmptyState
                icon={MagnifyingGlass}
                title={t.search.emptyTitle}
                description={t.search.emptyFilterDescription(selectedChips[0]?.label ?? "")}
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
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FavoriteRestaurantCard restaurant={item} onPress={openRestaurant} />
            )}
            // 16 между карточками (node 3452:13343: `gap-[16px]`); было 24.
            ItemSeparatorComponent={() => <View style={{ height: listCard.gap }} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: navPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissKeyboard}
            // 24 заведения сегодня и до 100 на страницу — список должен
            // оставаться оконным, а не монтировать все карточки с фото сразу.
            initialNumToRender={6}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </ScreenContainer>

      {/* Колёса подбора, поднятые чипом. Ровно те же, что внутри шторки
          фильтров: второе колесо дат в одном экране означало бы два разных
          списка дней. */}
      <AvailabilityWheels
        open={availabilityPicker}
        value={filters.availability}
        onClose={() => setAvailabilityPicker(null)}
        onChange={changeAvailability}
      />

      <FilterSheet
        visible={sheetVisible}
        initialFilters={filters}
        cuisines={cuisinesQuery.data ?? []}
        cuisinesFailed={cuisinesQuery.isError}
        onRetryCuisines={() => cuisinesQuery.refetch()}
        amenities={amenitiesQuery.data ?? []}
        amenitiesLoading={amenitiesQuery.isPending}
        amenitiesFailed={amenitiesQuery.isError}
        onRetryAmenities={() => void amenitiesQuery.refetch()}
        cities={citiesQuery.data ?? []}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          closeSheet();
        }}
        onClose={closeSheet}
      />

      <BottomNavBar />
    </View>
  );
}

/**
 * Чип, который СНИМАЕТ свой фильтр: кухня, удобство, цена, город, флаги.
 */
interface RemovableChip {
  kind: "remove";
  key: string;
  label: string;
  /** Как выглядят фильтры поиска после снятия чипа. Обязателен: чип, который
   * ничего не снимает, — это подпись, притворяющаяся кнопкой. */
  removeFilters: (prev: SearchFilters) => SearchFilters;
}

/**
 * Чип половины подбора «дата + гости»: он не снимает ничего, он МЕНЯЕТ выбор.
 * Крестика у него нет намеренно — снятая половина оставила бы серверу
 * бессмысленный запрос (см. `buildSelectedChips`).
 */
interface AvailabilityChip {
  kind: "availability";
  key: string;
  label: string;
  /** Какое колесо поднимать. */
  half: AvailabilityHalf;
  /** Название половины для скринридера — «Дата» / «Гости». */
  sectionTitle: string;
}

type SelectedChip = RemovableChip | AvailabilityChip;

/** Подписи времени суток — из того же словаря, что и чипы в шторке; свой
 * список слов здесь завёлся бы ровно для того, чтобы разойтись с ними. */
const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: t.search.filters.timeOfDayMorning,
  lunch: t.search.filters.timeOfDayLunch,
  dinner: t.search.filters.timeOfDayDinner,
};

/**
 * Разворачивает ВЕСЬ применённый подбор в чипы «выбранного» — ровно то, что
 * гость собрал в шторке: дата и гости, цена, кухни, удобства, «открыто
 * сейчас», «бронь онлайн», город. Порядок совпадает с порядком разделов
 * шторки, чтобы ряд читался как её краткий пересказ.
 *
 * Каждый чип здесь означает «выдача сужена по этому признаку» — иного вида
 * чипов на экране больше нет. Раздел «Повод» убран из шторки 2026-08-25
 * вместе со своим чипом: он выдачу не сужал.
 *
 * Дата и гости — ДВА чипа (макет 347:5942), но пара под ними неделима: у них
 * нет крестика, тап МЕНЯЕТ половину колесом и досылает вторую
 * (`AvailabilityWheels`). Снять подбор можно там, где это делается целиком, —
 * крестиком капсулы в шторке фильтров и «Сбросить». Крестик на половине
 * оставил бы серверу «дату без гостей», которую он молча игнорирует: чип
 * висит, выдача не сужена.
 */
function buildSelectedChips(
  filters: SearchFilters,
  cuisineNameById: Map<string, string>,
  amenityNameById: Map<string, string>,
  dateLabelFor: (dateKey: string) => string,
): SelectedChip[] {
  const chips: SelectedChip[] = [];

  if (filters.availability !== undefined) {
    const { date, guests } = filters.availability;
    chips.push(
      {
        kind: "availability",
        key: "availability:date",
        label: dateLabelFor(date),
        half: "date",
        sectionTitle: t.booking.dateSectionTitle,
      },
      {
        kind: "availability",
        key: "availability:guests",
        label: t.booking.guestsCount(guests),
        half: "guests",
        sectionTitle: t.booking.guestsSectionTitle,
      },
    );
    // Время суток — часть того же подбора, но, в отличие от даты и гостей,
    // снимается ОТДЕЛЬНО: без него запрос остаётся осмысленным (весь день),
    // а без даты или гостей — нет. Без этого чипа применённое «Обед» не было
    // бы видно на экране выдачи вовсе, и снять его можно было бы только
    // вернувшись в шторку.
    const period = filters.availability.timeOfDay;
    if (period !== undefined) {
      chips.push({
        kind: "remove",
        key: "availability:timeOfDay",
        label: TIME_OF_DAY_LABELS[period],
        removeFilters: (prev) => ({
          ...prev,
          availability: prev.availability
            ? { ...prev.availability, timeOfDay: undefined }
            : undefined,
        }),
      });
    }
  }
  if (filters.priceLevel !== undefined) {
    const priceLevel: PriceLevel = filters.priceLevel;
    chips.push({
      kind: "remove",
      key: "price",
      label: priceLevel,
      removeFilters: (prev) => ({ ...prev, priceLevel: undefined }),
    });
  }
  for (const id of filters.cuisineIds) {
    chips.push({
      kind: "remove",
      key: `cuisine:${id}`,
      label: cuisineNameById.get(id) ?? id,
      removeFilters: (prev) => ({
        ...prev,
        cuisineIds: prev.cuisineIds.filter((x) => x !== id),
      }),
    });
  }
  for (const id of filters.amenityIds) {
    chips.push({
      kind: "remove",
      key: `amenity:${id}`,
      // Название из справочника; не пришло — показываем код, но чип не
      // прячем: невидимый фильтр гость не снимет.
      label: amenityNameById.get(id) ?? id,
      removeFilters: (prev) => ({
        ...prev,
        amenityIds: prev.amenityIds.filter((x) => x !== id),
      }),
    });
  }
  if (filters.openNowOnly) {
    chips.push({
      kind: "remove",
      key: "openNow",
      label: t.search.filterOpenNow,
      removeFilters: (prev) => ({ ...prev, openNowOnly: false }),
    });
  }
  if (filters.onlineBookableOnly) {
    chips.push({
      kind: "remove",
      key: "onlineBookable",
      label: t.search.filterOnlineBookable,
      removeFilters: (prev) => ({ ...prev, onlineBookableOnly: false }),
    });
  }
  if (filters.city !== undefined) {
    const city = filters.city;
    chips.push({
      kind: "remove",
      key: "city",
      label: city,
      removeFilters: (prev) => ({ ...prev, city: undefined }),
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
    // 16/12/16 — поля шапки поиска из макета (Figma 3z0f6dgev4HMwBAHPjTjPo,
    // node 918:12554: `pt-[16px] pb-[12px] px-[16px]`). Верхних 16 раньше не
    // было вовсе: строка поиска липла к статус-бару.
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    // 12 между строкой поиска и рядом чипов (node 918:12555: `gap-[12px]`).
    // Было 8.
    gap: spacing.md,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    // 6 между кнопкой-ползунками и чипами (node 918:12561: `gap-[6px]`).
    // Было 12 — из прежнего узла 347:5942, где ряд состоял из более широких
    // чипов даты и гостей. В шкале spacing шага 6 нет, поэтому он собран из
    // существующих токенов, как и в других местах приложения.
    gap: spacing.xs + 2,
  },
  chipsRow: {
    flexDirection: "row",
    // Тот же шаг 6, что и до первого чипа: в макете ряд идёт ровным ритмом,
    // а не «6 до первого, 8 между остальными». Было 8.
    gap: spacing.xs + 2,
    alignItems: "center",
  },
  stateContent: {
    // Пустое состояние занимает ленту целиком — иначе тянуть нечего.
    flexGrow: 1,
  },
  listContent: {
    // Боковой отступ ленты — 16 (node 3452:13343: `px-[16px]`), и он теперь
    // принадлежит ЛЕНТЕ. У прежней карточки снимок отступал от края на 8, а
    // текст под ним на 16, поэтому отступа у списка не было; в новой карточке
    // подпись лежит на снимке, и у карточки одна левая граница.
    paddingHorizontal: listCard.listPadding,
    paddingBottom: spacing.xxxl,
  },
});
