import type { Amenity, Cuisine, PriceLevel, SearchFilters } from "@bookeat/api";
import { EMPTY_FILTERS } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useEffect, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSheetAnimation } from "../../lib/sheet-animation";
import { EMPTY_UI_FACETS, type UiOnlyFacets } from "../../hooks/useSearch";
import { FilterChip } from "../FilterChip";
import { IconButton } from "../IconButton";
import { PrimaryButton } from "../PrimaryButton";
import { X } from "../icons";
import { AvailabilityBar, type AvailabilityPicker } from "./AvailabilityBar";
import { CheckboxRow } from "./CheckboxRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { SegmentedControl } from "./SegmentedControl";

const t = getDictionary();

/** Повод — ФИКСИРОВАННЫЕ id UI-состояния (серверного поля под него нет).
 * Порядок = порядок в макете. Подписи берутся из i18n по этим id.
 *
 * Удобства раньше были таким же зашитым списком (`AMENITY_IDS` из семи
 * значений). Список удалён: справочник приходит с сервера
 * (`GET /venue-features`, 19 записей) и подписи тоже — см. проп `amenities`. */
// EXTRA_FACETS — «Открыто сейчас»/«Бронь онлайн»/город. Этих трёх в макете
// шторки НЕТ; добавлены по просьбе Damir (2026-08-05), потому что бэкенд их
// поддерживает и «бронь онлайн» реально полезен. Чтобы вернуться строго к
// макету — поставь флаг в false (или удали блок «Ещё» в разметке и этот флаг).
const SHOW_EXTRA_FACETS = true;

const OCCASION_IDS = ["date", "friends", "kids", "business", "celebration"] as const;

/** Ступени цены, которые понимает каталог (₸/₸₸/₸₸₸ — четвёртой нет), плюс
 * «Все» как отсутствие фильтра. Значение сегмента ложится прямо на
 * `SearchFilters.priceLevel`. */
const PRICE_SEGMENTS: { value: PriceLevel | undefined; label: string }[] = [
  { value: undefined, label: t.search.filters.priceAll },
  { value: "₸", label: "₸" },
  { value: "₸₸", label: "₸₸" },
  { value: "₸₸₸", label: "₸₸₸" },
];

interface FilterSheetProps {
  visible: boolean;
  /** Уже применённые фильтры и UI-фасеты — черновик шторки заводится с них при
   * каждом открытии, поэтому «поменял и закрыл крестиком» ничего не применяет. */
  initialFilters: SearchFilters;
  initialUiFacets: UiOnlyFacets;
  /** Кухни грузятся тем же запросом, что и на экране поиска; шторка их только
   * показывает и не знает, откуда они. */
  cuisines: Cuisine[];
  cuisinesFailed: boolean;
  onRetryCuisines: () => void;
  /**
   * Справочник удобств — приходит тем же способом, что и кухни: экран грузит,
   * шторка только показывает. Приходит ЦЕЛИКОМ, включая записи, которых пока
   * нет ни у одного заведения (решение владельца): выбор такого удобства даёт
   * обычную пустую выдачу со ссылкой «Сбросить фильтры».
   */
  amenities: Amenity[];
  amenitiesLoading: boolean;
  amenitiesFailed: boolean;
  onRetryAmenities: () => void;
  /** Города для группы «Ещё» (EXTRA_FACETS). Пусто/не нужно — если флаг выключен. */
  cities: string[];
  /**
   * Колесо даты/гостей, раскрытое сразу вместе со шторкой. Приходит с главной
   * через параметр маршрута `focus`: гость нажал там дату — он должен увидеть
   * выбор даты, а не список фильтров, в котором её ещё надо найти.
   */
  initialPicker?: AvailabilityPicker;
  /** Применить: коммитим черновик обратно в реальные фильтры и закрываем. */
  onApply: (filters: SearchFilters, uiFacets: UiOnlyFacets) => void;
  onClose: () => void;
}

/**
 * Нижняя шторка «Фильтры» (модалка снизу, затемнённый фон, скруглённый верх).
 *
 * Всё, что гость трогает внутри, — ЧЕРНОВИК: локальное состояние, заведённое
 * из применённых фильтров при открытии. В реальные фильтры поиска оно уходит
 * только по «Применить»; закрытие крестиком/по фону — отмена. «Сбросить
 * фильтры» очищает черновик до пустого (гостей возвращает к дефолту).
 *
 * Бэкенд ищет по кухне, УДОБСТВАМ (`?features=`), цене, «открыто сейчас»,
 * «бронь онлайн», городу, дате и гостям — всё это лежит в `SearchFilters` и
 * реально сужает выдачу. Фильтром НЕ является только повод: серверного поля
 * под него нет, он живёт в `UiOnlyFacets` и запоминается, но выдачу не
 * сужает.
 */
export function FilterSheet({
  visible,
  initialFilters,
  initialUiFacets,
  cuisines,
  cuisinesFailed,
  onRetryCuisines,
  amenities,
  amenitiesLoading,
  amenitiesFailed,
  onRetryAmenities,
  cities,
  initialPicker,
  onApply,
  onClose,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { mounted, progress, translateY } = useSheetAnimation(visible);
  const [draft, setDraft] = useState<SearchFilters>(initialFilters);
  const [facets, setFacets] = useState<UiOnlyFacets>(initialUiFacets);
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);

  // Заводим черновик заново при КАЖДОМ открытии — вход в шторку всегда
  // отражает то, что реально применено, а не остатки прошлой правки.
  useEffect(() => {
    if (!visible) return;
    setDraft(initialFilters);
    setFacets(initialUiFacets);
    setCuisineOpen(false);
    setAmenitiesOpen(false);
  }, [visible, initialFilters, initialUiFacets]);

  const toggleOccasion = (id: string) =>
    setFacets((prev) => ({ ...prev, occasionIds: toggleId(prev.occasionIds, id) }));

  const toggleAmenity = (id: string) =>
    setDraft((prev) => ({ ...prev, amenityIds: toggleId(prev.amenityIds, id) }));

  const toggleCuisine = (id: string) =>
    setDraft((prev) => ({ ...prev, cuisineIds: toggleId(prev.cuisineIds, id) }));

  const setPrice = (priceLevel: PriceLevel | undefined) =>
    setDraft((prev) => ({ ...prev, priceLevel }));

  // EXTRA_FACETS: поддержаны бэкендом (уходят в реальные фильтры), поэтому живут
  // в draft, а не в UiOnlyFacets. Город — одиночный выбор: повторный тап снимает.
  const toggleOpenNow = () =>
    setDraft((prev) => ({ ...prev, openNowOnly: !prev.openNowOnly }));
  const toggleCity = (city: string) =>
    setDraft((prev) => ({ ...prev, city: prev.city === city ? undefined : city }));

  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setFacets(EMPTY_UI_FACETS);
  };

  const summary = (count: number) =>
    count === 0 ? t.search.filters.summaryNone : t.search.filters.summaryCount(count);

  // Что выбрано в свёрнутом разделе: те же чипы, что и внутри него, только с
  // крестиком. Название кухни берём из загруженного списка; если он ещё не
  // пришёл — показываем id, но не прячем чип: спрятанный выбранный фильтр
  // читается как «ничего не выбрано».
  const cuisineName = (id: string) => cuisines.find((c) => c.id === id)?.name ?? id;

  const selectedCuisineChips = draft.cuisineIds.map((id) => (
    <FilterChip
      key={id}
      label={cuisineName(id)}
      selected
      selectedTone="brand"
      onPress={() => toggleCuisine(id)}
      onRemove={() => toggleCuisine(id)}
      removeAccessibilityLabel={t.a11y.removeFilter(cuisineName(id))}
    />
  ));

  // Подпись удобства — ТОЛЬКО из справочника, пришедшего с сервера: своих
  // подписей у приложения больше нет, иначе они разойдутся с теми, что
  // владелец правит в кабинете. Справочник ещё не пришёл (или удобство из
  // него убрали) — показываем код: спрятанный выбранный фильтр читается как
  // «ничего не выбрано», ровно как у кухонь.
  const amenityName = (id: string): string => amenities.find((a) => a.id === id)?.name ?? id;

  const selectedAmenityChips = draft.amenityIds.map((id) => {
    const label = amenityName(id);
    return (
      <FilterChip
        key={id}
        label={label}
        selected
        selectedTone="brand"
        onPress={() => toggleAmenity(id)}
        onRemove={() => toggleAmenity(id)}
        removeAccessibilityLabel={t.a11y.removeFilter(label)}
      />
    );
  });

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Затемнённый фон — только тап-цель, скрыт от скринридера, чтобы
            фокус попадал на шторку, а не на безымянную кнопку во весь экран. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            importantForAccessibility="no"
            accessibilityElementsHidden
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t.search.filters.title}
            </Text>
            <IconButton icon={X} onPress={onClose} accessibilityLabel={t.common.close} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Дата и гости — часть подбора, поэтому живут здесь, вместе с
                остальными условиями (решение владельца 18.08.2026). Раньше
                капсула стояла над выдачей отдельно от фильтров.

                СТАРЫЙ КОММЕНТАРИЙ, важный для будущего:
                Раньше тут стояли такие же плашки — статичные «Сегодня» и «2
                гостя», — и когда выбор стал настоящим, человек видел в капсуле
                «Завтра, 1 гость», открывал фильтры и читал «Сегодня, 2 гостя».
                Два места для одного выбора всегда кончаются так — поэтому и
                сейчас место остаётся ровно одно, просто другое. */}
            <AvailabilityBar
              initialPicker={initialPicker}
              value={draft.availability}
              onChange={(availability) => setDraft((prev) => ({ ...prev, availability }))}
            />

            {/* Повод — мультивыбор, красная заливка выбранного.
                TODO(track-C backend): повод в поиск не уходит, только UI. */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.search.filters.occasionTitle}</Text>
              <View style={styles.wrap}>
                {OCCASION_IDS.map((id) => (
                  <FilterChip
                    key={id}
                    label={t.search.filters.occasion[id]}
                    selected={facets.occasionIds.includes(id)}
                    selectedTone="brand"
                    onPress={() => toggleOccasion(id)}
                  />
                ))}
              </View>
            </View>

            {/* Ценовая категория — одиночный выбор, поддержан бэкендом. */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.search.filters.priceTitle}</Text>
              <SegmentedControl
                segments={PRICE_SEGMENTS}
                value={draft.priceLevel}
                onChange={setPrice}
                accessibilityLabel={t.search.filters.priceTitle}
              />
            </View>

            {/* Кухня — мультивыбор, поддержан бэкендом (cuisineIds). */}
            <View style={styles.section}>
              <CollapsibleSection
                title={t.search.filters.cuisineTitle}
                summary={summary(draft.cuisineIds.length)}
                hasSelection={draft.cuisineIds.length > 0}
                expanded={cuisineOpen}
                onToggle={() => setCuisineOpen((v) => !v)}
                selectionChips={selectedCuisineChips}
              >
                {cuisinesFailed ? (
                  // Кухни грузятся отдельным запросом: если он упал — именно
                  // это, а не пустой ряд, который читается как «кухонь нет».
                  <FilterChip
                    label={t.search.filterCuisinesFailed}
                    selected={false}
                    onPress={onRetryCuisines}
                  />
                ) : (
                  <View style={styles.wrap}>
                    {cuisines.map((cuisine) => (
                      <FilterChip
                        key={cuisine.id}
                        label={cuisine.name}
                        selected={draft.cuisineIds.includes(cuisine.id)}
                        selectedTone="brand"
                        onPress={() => toggleCuisine(cuisine.id)}
                      />
                    ))}
                  </View>
                )}
              </CollapsibleSection>
            </View>

            {/* Удобства — мультивыбор чекбоксами, значения из СПРАВОЧНИКА
                сервера, выбранное уходит параметром `features` (И). */}
            <View style={styles.section}>
              <CollapsibleSection
                title={t.search.filters.amenitiesTitle}
                summary={summary(draft.amenityIds.length)}
                hasSelection={draft.amenityIds.length > 0}
                expanded={amenitiesOpen}
                onToggle={() => setAmenitiesOpen((v) => !v)}
                selectionChips={selectedAmenityChips}
              >
                {/* Четыре состояния справочника, как у любого запроса: ошибка
                    (чип-повтор, как у кухонь), загрузка, пустой справочник и
                    список. Разделять их обязательно — пустой список галочек
                    читается как «удобств не бывает», хотя мы просто ещё не
                    дождались ответа. */}
                {amenitiesFailed ? (
                  <FilterChip
                    label={t.search.filterAmenitiesFailed}
                    selected={false}
                    onPress={onRetryAmenities}
                  />
                ) : amenitiesLoading ? (
                  <Text style={styles.sectionNote}>{t.common.loading}</Text>
                ) : amenities.length === 0 ? (
                  <Text style={styles.sectionNote}>{t.search.filterAmenitiesEmpty}</Text>
                ) : (
                  amenities.map((amenity) => (
                    <CheckboxRow
                      key={amenity.id}
                      label={amenity.name}
                      checked={draft.amenityIds.includes(amenity.id)}
                      onToggle={() => toggleAmenity(amenity.id)}
                    />
                  ))
                )}
              </CollapsibleSection>
            </View>

            {/* Ещё (EXTRA_FACETS) — не из макета, добавлено по просьбе Damir.
                Все три поддержаны бэкендом и уходят в реальные фильтры. Чтобы
                вернуться к макету — SHOW_EXTRA_FACETS=false. */}
            {SHOW_EXTRA_FACETS ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.search.filters.extraTitle}</Text>
                <View style={styles.wrap}>
                  <FilterChip
                    label={t.search.filterOpenNow}
                    selected={draft.openNowOnly}
                    selectedTone="brand"
                    onPress={toggleOpenNow}
                  />
                  {/* Фильтра «бронь онлайн» здесь нет: заведение подключают к
                      BookEat именно ради онлайн-брони, поэтому предлагать её как
                      условие подбора — предлагать выключить то, ради чего человек
                      и пришёл. Само поле в фильтрах осталось: им пользуется
                      каталог, а у заведения без залов бронь по-прежнему честно
                      недоступна на его карточке. */}
                </View>
                {cities.length > 0 ? (
                  <View style={styles.wrap}>
                    {cities.map((city) => (
                      <FilterChip
                        key={city}
                        label={city}
                        selected={draft.city === city}
                        selectedTone="brand"
                        onPress={() => toggleCity(city)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton
              label={t.search.filters.apply}
              size="lg"
              onPress={() => onApply(draft, facets)}
            />
            <PrimaryButton
              label={t.search.filters.reset}
              variant="secondary"
              size="lg"
              onPress={reset}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Плоская статичная пилюля «иконка + текст» для даты и гостей. Не Pressable
 * намеренно: пикера за ней пока нет (track-C), а кнопка, которая ничего не
 * делает, — тот же обман, что и фейковый фильтр. */

/** Добавить/убрать id из массива выбранных — общий тумблер для всех
 * мультивыборов шторки. */
function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay.dialogScrim,
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    // Не даём шторке дорасти до самого верха — над ней всегда виден фон.
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: spacing.xxl,
    paddingRight: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  body: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  /** Одна строка внутри раздела вместо списка: «Загрузка» или «справочник
   * пуст». Не `EmptyState` — у него иконка и отступы во весь экран, а здесь
   * место ровно на строку. */
  sectionNote: {
    ...typography.body,
    color: colors.text.mutedStrong,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
  },
});
