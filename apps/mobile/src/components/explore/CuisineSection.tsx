import type { Cuisine } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { CardStrip } from "./CardStrip";
import { CuisineChip } from "./CuisineChip";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useExploreCuisines } from "./use-explore-data";

const t = getDictionary();

/**
 * «Выберите кухню» — circular cuisine chips built from the catalog's distinct
 * `cuisine_type` values (GET /restaurants/cuisines). Tapping a chip opens the
 * catalog filtered to that cuisine.
 *
 * This is a secondary navigation shortcut (the same filter lives on the search
 * screen), so it stays out of the way when it has nothing to add: an EMPTY or
 * FAILED cuisine list HIDES the whole section rather than showing a broken or
 * empty block, keeping the home screen finished on real data. Only the loading
 * state draws anything provisional — a row of skeleton circles.
 */
export function CuisineSection({ onPickCuisine }: { onPickCuisine: (cuisine: Cuisine) => void }) {
  const query = useExploreCuisines();

  if (query.isLoading) {
    return (
      <SectionCard>
        <SectionHeader title={t.explore.cuisineTitle} showChevron={false} />
        <SkeletonRow />
      </SectionCard>
    );
  }

  const cuisines = query.data ?? [];
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
        itemWidth={exploreLayout.cuisineChip}
        renderItem={({ item }) => <CuisineChip cuisine={item} onSelect={onPickCuisine} />}
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
        <View key={key} style={styles.skeletonCircle} />
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
  skeletonCircle: {
    width: exploreLayout.cuisineChip,
    height: exploreLayout.cuisineChip,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
});
