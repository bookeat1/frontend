import type { Cuisine } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { CardStrip } from "./CardStrip";
import { CuisineChip } from "./CuisineChip";
import { cuisinePhoto } from "./cuisine-photos";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useCuisinePhotos, useExploreCuisines } from "./use-explore-data";

const t = getDictionary();

/**
 * «Выберите кухню» — круги кухонь из СПРАВОЧНИКА (`GET /cuisines`): и состав,
 * и порядок задаёт сервер (`display_order`), а не то, какие заведения попали в
 * первую страницу каталога. Тап открывает каталог, отфильтрованный по этой
 * кухне (значение фильтра — код справочника).
 *
 * This is a secondary navigation shortcut (the same filter lives on the search
 * screen), so it stays out of the way when it has nothing to add: an EMPTY or
 * FAILED cuisine list HIDES the whole section rather than showing a broken or
 * empty block, keeping the home screen finished on real data. Only the loading
 * state draws anything provisional — a row of skeleton circles.
 *
 * КАРТИНКИ (правка владельца 2026-08-21). Раньше кухня без снимка, лежащего в
 * приложении, выпадала из ряда: на боевом каталоге снимки были у двух кухонь
 * из девяти, и ряд выглядел пустым. Теперь недостающие снимки берутся у
 * реальных заведений этой кухни (useCuisinePhotos), и кухня скрывается, только
 * если фотографии нет ВООБЩЕ нигде — то есть у всех её заведений пустой
 * каталог фотографий.
 */
export function CuisineSection({ onPickCuisine }: { onPickCuisine: (cuisine: Cuisine) => void }) {
  const query = useExploreCuisines();
  const photos = useCuisinePhotos();

  if (query.isLoading) {
    return (
      <SectionCard>
        <SectionHeader title={t.explore.cuisineTitle} showChevron={false} />
        <SkeletonRow />
      </SectionCard>
    );
  }

  // Показываем только кухни, для которых картинка есть хоть где-то: круг-
  // заглушка в ряду картинок читается как «не загрузилось», а не как «такая
  // кухня есть». Решение владельца от 17.08.2026.
  //
  // Источников три, в порядке предпочтения (см. CuisineChip): ссылка из
  // справочника, вшитый в сборку снимок, фотография заведения этой кухни.
  // Порядок ряда при этом остаётся справочный — фильтр только выкидывает
  // лишнее, не пересортировывает.
  const cuisines = (query.data ?? []).filter(
    (cuisine) =>
      Boolean(cuisine.imageUrl) ||
      cuisinePhoto(cuisine.id) !== undefined ||
      photos.has(cuisine.id),
  );
  // Hide the whole section on empty OR error — a cuisine shortcut the guest
  // never sees is better than a dead or broken block on the first screen.
  if (query.isError || cuisines.length === 0) {
    return null;
  }

  return (
    <SectionCard>
      <SectionHeader title={t.explore.cuisineTitle} showChevron={false} />
      <CardStrip
        data={cuisines}
        keyExtractor={(cuisine) => cuisine.id}
        accessibilityLabel={t.explore.cuisineTitle}
        // Ячейка hug по подписи (см. CuisineChip): «Морепродукты» шире круга и
        // не ужимается, поэтому ширина ячеек переменная.
        itemWidth="hug"
        itemGap={spacing.md}
        renderItem={({ item }) => (
          <CuisineChip cuisine={item} onSelect={onPickCuisine} photoUri={photos.get(item.id)} />
        )}
      />
    </SectionCard>
  );
}

/** A row of skeleton circles with the chips' geometry. */
function SkeletonRow() {
  return (
    <View
      style={styles.skeletonRow}
      accessibilityRole="progressbar"
      accessibilityLabel={t.explore.cuisineLoading}
    >
      {[0, 1, 2, 3].map((key) => (
        // Ячейка минимальной ширины настоящего чипа (круг 96): у чипа ширина
        // hug по подписи, так что после загрузки ряд может чуть раздвинуться
        // на длинных названиях — это ожидаемо, шаг ряда тот же.
        <View key={key} style={styles.skeletonCell}>
          <View style={styles.skeletonCircle} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  skeletonCell: {
    minWidth: exploreLayout.cuisineChip,
    alignItems: "center",
  },
  skeletonCircle: {
    width: exploreLayout.cuisineChip,
    height: exploreLayout.cuisineChip,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
});
