import { colors, spacing } from "@bookeat/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { OptionRow } from "../../src/components/OptionRow";
import { EmptyState, ErrorState, LoadingState } from "../../src/components/StateViews";
import { resolveCitySelection } from "../../src/lib/city-select";
import { useLocale } from "../../src/lib/locale";
import { useRepository } from "../../src/lib/repository";

/**
 * City picker — one screen reused as a catalog FILTER and as the profile city
 * FIELD. It reads the same `GET /cities` the search filter uses (a bare array
 * of strings; the backend has no city dictionary or ids behind it), so both
 * callers pick from exactly the venues' real cities.
 *
 * The chosen city is handed back through the `city-select` mailbox (expo-router
 * `back()` carries no payload), then the screen pops. A "clear" row is always
 * offered when not searching: the FILTER reads a cleared value as «все города»,
 * the PROFILE as «город не указан» — the mailbox passes `null` and each caller
 * maps it. Which of the two `purpose` chooses is only the clear-row wording.
 *
 * Four states, all present: loading / error (retry) / empty catalog vs. no
 * search match (different copy) / the list.
 */
export default function CitySelectScreen() {
  const router = useRouter();
  const repository = useRepository();
  const { dictionary: t } = useLocale();
  const { selected } = useLocalSearchParams<{ selected?: string }>();

  // Same cache key as the search screen's city filter — opening the picker
  // right after using the filter costs no extra request.
  const citiesQuery = useQuery({
    queryKey: ["cities"],
    queryFn: () => repository.getCities(),
  });

  const pick = (city: string | null) => {
    resolveCitySelection(city);
    router.back();
  };

  // Поиска здесь нет по решению владельца (18.08.2026): городов в каталоге
  // единицы, и строка поиска над списком из двух пунктов — лишний шаг.
  const cities = citiesQuery.data ?? [];
  const hasCities = cities.length > 0;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.city.title} onBack={() => router.back()} />
      </SafeAreaView>

      {citiesQuery.isPending ? (
        <LoadingState title={t.city.loadingTitle} />
      ) : citiesQuery.isError ? (
        <ErrorState
          title={t.city.errorTitle}
          description={t.city.errorDescription}
          action={{
            label: t.common.retry,
            onPress: () => void citiesQuery.refetch(),
            variant: "button",
          }}
        />
      ) : !hasCities ? (
        // The server returned no cities at all — not a failed search.
        <EmptyState title={t.city.catalogEmptyTitle} description={t.city.catalogEmptyDescription} />
      ) : (
        <FlatList
          data={cities}
          keyExtractor={(city) => city}
          renderItem={({ item }) => (
            <OptionRow label={item} selected={item === selected} onPress={() => pick(item)} variant="radio" />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Белый лист, как в макете (node 903:9001): городов всего два, серые
    // плашки вокруг них выглядели тяжелее самого выбора.
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  separator: {
    height: 0,
  },
});
