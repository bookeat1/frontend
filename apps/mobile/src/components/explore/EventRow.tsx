import type { EventSummary } from "@bookeat/api";
import { colors, exploreLayout, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatEventDateBlock, formatRelativeDateTime, formatTime } from "../../lib/format";
import { PhotoView } from "../PhotoView";
import { TagChips } from "../TagChips";

const t = getDictionary();

/**
 * Строка «Афиши» на главной — РЕАЛЬНЫЕ ДАННЫЕ (GET /events).
 *
 * Свёрстана по макету 3z0f6dgev4HMwBAHPjTjPo, node 3228:9823 (правка
 * владельца 25.08.2026): слева дата ТЕКСТОМ (крупное число и приглушённый
 * месяц под ним), в середине название с подписью «заведение · время» и
 * меткой, справа фотография 110x104.
 *
 * Прежний вариант (node 3053:8813) клал дату НА фотографию слева — именно его
 * владелец опознал как «снова выглядит как раньше». Дату вернули в текст:
 * белая цифра на чужом снимке читается ровно настолько, насколько повезло с
 * фотографией, а тут она всегда одинаково контрастна.
 *
 * Высоту строки задаёт фотография (104), текст слева ниже и центрируется по
 * ней. Длинное название занимает вторую строку и делает карточку на пару
 * точек выше — это допустимо, обрезать название до одной строки хуже.
 */

/**
 * Сколько меток показывает строка на главной. Ровно одна, как в макете: ряд
 * меток здесь переносится по словам, и вторая метка утащила бы карточку вниз,
 * разорвав ряд из трёх одинаковых строк.
 */
const HOME_ROW_TAGS = 1;

export function EventRow({
  event,
  onOpenEvent,
}: {
  event: EventSummary;
  onOpenEvent: (eventId: string) => void;
}) {
  const dateBlock = formatEventDateBlock(event.startsAt);
  const time = formatTime(event.startsAt);
  const venueName = event.restaurant.name || event.venue;

  const body = (
    <>
      {dateBlock ? (
        <View style={styles.dateBlock}>
          <Text style={styles.dateDay}>{dateBlock.day}</Text>
          <Text style={styles.dateMonth}>{dateBlock.month}</Text>
        </View>
      ) : null}

      <View style={styles.text}>
        <View style={styles.headline}>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {event.title}
          </Text>
          {/* «Заведение · время» — три отдельных элемента, как в макете:
              разделитель мельче самих подписей (12 против 14), поэтому строка
              не склеивается в один Text. Точка появляется только когда есть
              обе части, иначе подпись начиналась бы или кончалась точкой. */}
          {venueName || time ? (
            <View style={styles.meta}>
              {venueName ? (
                <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                  {venueName}
                </Text>
              ) : null}
              {venueName && time ? <Text style={styles.metaDot}>·</Text> : null}
              {time ? <Text style={styles.metaText}>{time}</Text> : null}
            </View>
          ) : null}
        </View>
        {/* Метки — собственные теги заведения («Бранч», «Живая музыка»), они
            приходят в событии. Ряд прячется сам, когда их нет (см. TagChips):
            выдуманных подписей здесь не появляется. `flush` — потому что зазор
            над метками уже задан колонкой (8 из макета). */}
        <TagChips tags={event.tags.slice(0, HOME_ROW_TAGS)} flush />
      </View>

      <PhotoView uri={event.coverImageUrl} style={styles.thumb} decorative placeholderIconSize={28} />
    </>
  );

  // Без идентификатора события открывать нечего — карточка остаётся блоком.
  if (!event.id) {
    return <View style={styles.row}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.explore.eventCard(
        event.title,
        formatRelativeDateTime(event.startsAt),
        event.restaurant.name,
      )}
      onPress={() => onOpenEvent(event.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  // Ширина колонки даты в макете «по содержимому» (35–40 у разных чисел), а не
  // фиксированная: число всегда прижато к левому краю блока.
  dateBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  dateDay: {
    ...typography.dateNumber,
    color: colors.text.primary,
  },
  dateMonth: {
    ...typography.dateMonth,
    textTransform: "uppercase",
    color: colors.text.muted,
  },
  text: {
    flex: 1,
    gap: spacing.sm,
  },
  headline: {
    gap: spacing.xxs,
  },
  title: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    ...typography.body,
    color: colors.text.primary,
    flexShrink: 1,
  },
  metaDot: {
    ...typography.caption,
    color: colors.text.primary,
  },
  thumb: {
    width: exploreLayout.eventThumbWidth,
    height: exploreLayout.eventThumbHeight,
    borderRadius: radius.card,
  },
});
