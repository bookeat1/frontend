import { colors, exploreLayout, radius, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { DataErrorState } from "../DataErrorState";
import { EventRow } from "./EventRow";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useExploreEvents } from "./use-explore-data";

const t = getDictionary();

/** How many events the Home teaser shows before «смотреть все» takes over. */
const HOME_EVENTS_PREVIEW = 3;

/**
 * «Афиша» — cross-venue upcoming events on real data (GET /events), rendered as
 * a VERTICAL list (the old EventsSection was a horizontal strip).
 *
 * ПУСТО — блока НЕТ. Афиша это витрина, а не раздел с обязательным
 * содержимым: когда ближайших событий нет, заголовок «Афиша» с подписью «пока
 * ничего не запланировано» занимает экран ровно ничем. Так же ведут себя
 * соседи по главной («Акции», «Статьи», «Выберите кухню»). Ошибка и загрузка
 * при этом остаются видимыми: «не смогли загрузить» — это не «ничего нет».
 * Загрузка — скелет, а не крутилка, чтобы блок ниже не прыгал при появлении
 * данных.
 *
 * The rows are mapped, not put in a nested FlatList: the whole screen is
 * already a ScrollView, and a VirtualizedList inside one both warns and scrolls
 * badly. The list is capped at ~12 events upstream, so mapping is fine.
 *
 * The header chevron now navigates to the dedicated «Афиша» list screen
 * (`onSeeAll` → `/events`), which reads the SAME query — so it is a real
 * control, not decoration.
 */
export function EventsListSection({
  onOpenEvent,
  onSeeAll,
}: {
  onOpenEvent: (eventId: string) => void;
  onSeeAll?: () => void;
}) {
  const query = useExploreEvents();
  // The Home «Афиша» block is a teaser — at most 3 events; «смотреть все» opens
  // the full list (/events), which reads the same query.
  const events = (query.data?.items ?? []).slice(0, HOME_EVENTS_PREVIEW);

  // Нечего показать — блока нет вовсе, вместе с заголовком и стрелкой.
  if (!query.isLoading && !query.isError && events.length === 0) {
    return null;
  }

  return (
    <SectionCard>
      {/* Кегль заголовка `large` (20/28) — как в макете 3228:9821. */}
      <SectionHeader title={t.explore.afishaTitle} onSeeAll={onSeeAll} />

      {query.isLoading ? (
        <SkeletonList />
      ) : query.isError ? (
        <View style={styles.state}>
          <DataErrorState compact error={query.error} onRetry={() => void query.refetch()} />
        </View>
      ) : (
        <View style={styles.list}>
          {events.map((event) => (
            <EventRow key={event.id} event={event} onOpenEvent={onOpenEvent} />
          ))}
        </View>
      )}
    </SectionCard>
  );
}

/** Три заглушки строк с геометрией настоящих: дата слева, текст, фото справа. */
function SkeletonList() {
  return (
    <View
      style={styles.list}
      accessibilityRole="progressbar"
      accessibilityLabel={t.explore.eventsLoading}
    >
      {[0, 1, 2].map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <View style={styles.skeletonDate} />
          <View style={styles.skeletonText}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineNarrow} />
          </View>
          <View style={styles.skeletonThumb} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    paddingHorizontal: spacing.lg,
  },
  // Расстояние между строками — 16 из макета (node 3228:9889), разделителей
  // между ними нет.
  list: {
    gap: spacing.lg,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  skeletonDate: {
    width: 40,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  skeletonText: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonLineWide: {
    height: 16,
    width: "80%",
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  skeletonLineNarrow: {
    height: 12,
    width: "50%",
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  skeletonThumb: {
    width: exploreLayout.eventThumbWidth,
    height: exploreLayout.eventThumbHeight,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
});
