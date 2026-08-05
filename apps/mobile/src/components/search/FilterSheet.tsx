import type { Cuisine, PriceLevel, SearchFilters } from "@bookeat/api";
import { EMPTY_FILTERS } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EMPTY_UI_FACETS, type UiOnlyFacets } from "../../hooks/useSearch";
import { FilterChip } from "../FilterChip";
import { IconButton } from "../IconButton";
import { PrimaryButton } from "../PrimaryButton";
import { CalendarBlank, User, X, type IconProps } from "../icons";
import { CheckboxRow } from "./CheckboxRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { SegmentedControl } from "./SegmentedControl";

const t = getDictionary();

/** Поводы и удобства — ФИКСИРОВАННЫЕ id UI-состояния (в бэкенде их нет,
 * track-C). Порядок = порядок в макете. Подписи берутся из i18n по этим id. */
const OCCASION_IDS = ["date", "friends", "kids", "business", "celebration"] as const;
const AMENITY_IDS = [
  "terrace",
  "halal",
  "parking",
  "prayer_room",
  "kids_chairs",
  "pets",
  "live_music",
] as const;

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
 * Бэкенд ищет только по кухне/цене/«открыто сейчас»/«бронь онлайн»/городу.
 * Повод, удобства, дата и гости фильтром пока не являются — они живут в
 * `UiOnlyFacets` и запоминаются, но выдачу не сужают (track-C ниже).
 */
export function FilterSheet({
  visible,
  initialFilters,
  initialUiFacets,
  cuisines,
  cuisinesFailed,
  onRetryCuisines,
  onApply,
  onClose,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
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
    setFacets((prev) => ({ ...prev, amenityIds: toggleId(prev.amenityIds, id) }));

  const toggleCuisine = (id: string) =>
    setDraft((prev) => ({ ...prev, cuisineIds: toggleId(prev.cuisineIds, id) }));

  const setPrice = (priceLevel: PriceLevel | undefined) =>
    setDraft((prev) => ({ ...prev, priceLevel }));

  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setFacets(EMPTY_UI_FACETS);
  };

  const summary = (count: number) =>
    count === 0 ? t.search.filters.summaryNone : t.search.filters.summaryCount(count);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Затемнённый фон — только тап-цель, скрыт от скринридера, чтобы
            фокус попадал на шторку, а не на безымянную кнопку во весь экран. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
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
            {/* Дата и гости. TODO(track-C backend): дата/гости в поисковом
                запросе пока не существуют — это статичные плашки-намерения, а
                не рабочий пикер; ставить сюда фейковый выбор нельзя. */}
            <View style={styles.pillRow}>
              <FacetPill icon={CalendarBlank} label={t.search.filters.datePillToday} />
              <FacetPill icon={User} label={t.search.filters.guestsPill(facets.guests)} />
            </View>

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

            {/* Удобства — мультивыбор чекбоксами.
                TODO(track-C backend): удобства в поиск не уходят, только UI. */}
            <View style={styles.section}>
              <CollapsibleSection
                title={t.search.filters.amenitiesTitle}
                summary={summary(facets.amenityIds.length)}
                hasSelection={facets.amenityIds.length > 0}
                expanded={amenitiesOpen}
                onToggle={() => setAmenitiesOpen((v) => !v)}
              >
                {AMENITY_IDS.map((id) => (
                  <CheckboxRow
                    key={id}
                    label={t.search.filters.amenities[id]}
                    checked={facets.amenityIds.includes(id)}
                    onToggle={() => toggleAmenity(id)}
                  />
                ))}
              </CollapsibleSection>
            </View>
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
        </View>
      </View>
    </Modal>
  );
}

/** Плоская статичная пилюля «иконка + текст» для даты и гостей. Не Pressable
 * намеренно: пикера за ней пока нет (track-C), а кнопка, которая ничего не
 * делает, — тот же обман, что и фейковый фильтр. */
function FacetPill({ icon: Icon, label }: { icon: React.ComponentType<IconProps>; label: string }) {
  return (
    <View style={styles.facetPill}>
      <Icon size={20} color={colors.text.primary} weight="regular" />
      <Text style={styles.facetPillLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

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
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  facetPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  facetPillLabel: {
    ...typography.labelMedium,
    color: colors.text.primary,
    flexShrink: 1,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.titleSm,
    color: colors.text.primary,
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
