import type { EventSummary } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatEventDateBlock, formatRelativeDateTime, formatTime } from "../../lib/format";
import { PhotoView } from "../PhotoView";
import { TagChips } from "../TagChips";

const t = getDictionary();

/**
 * Карточка афиши в листинге на главной — РЕАЛЬНЫЕ ДАННЫЕ (GET /events).
 *
 * Перерисована по макету 3z0f6dgev4HMwBAHPjTjPo, node 3053:8813 (правка
 * владельца 2026-08-20). Было: маленькое число слева, текст, крохотная
 * фотография справа. Стало: слева кадр 139x116 с фотографией, поверх неё
 * затемнение и дата, справа название, строка «заведение · время» и метки.
 *
 * ДАТА ЛЕЖИТ НА ФОТОГРАФИИ, а не рядом с ней: карточка отвечает на вопрос
 * «когда и где», и в новом макете число читается первым, укрупнившись с 24 до
 * 32. Затемнение под ним обязательно — без него белая цифра тонет на светлом
 * блюде.
 *
 * Метки — собственные теги заведения («Бранч», «Живая музыка»), они приходят
 * в событии. Ряд меток прячется сам, когда их нет (см. TagChips): выдуманных
 * подписей здесь не появляется.
 */

/** Кадр с датой — 139x116 из макета (node 3053:8885). */
const DATE_FRAME_WIDTH = 139;
const DATE_FRAME_HEIGHT = 116;

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
      <View style={styles.cover}>
        <PhotoView uri={event.coverImageUrl} style={styles.coverPhoto} decorative placeholderIconSize={24} />
        {/* Затемнение и дата — отдельными слоями поверх снимка. Слой
            затемнения не перехватывает касания: нажатие принадлежит всей
            карточке. */}
        <View style={styles.coverScrim} pointerEvents="none" />
        {dateBlock ? (
          <View style={styles.dateBlock} pointerEvents="none">
            <Text style={styles.dateDay}>{dateBlock.day}</Text>
            <Text style={styles.dateMonth}>{dateBlock.month}</Text>
          </View>
        ) : null}
      </View>

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
        <TagChips tags={event.tags} size="compact" />
      </View>
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
  cover: {
    width: DATE_FRAME_WIDTH,
    height: DATE_FRAME_HEIGHT,
    borderRadius: radius.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.bannerPlaceholder,
  },
  coverPhoto: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  coverScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay.photoDate,
  },
  dateBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  // Число даты — 32/34 из макета: самый крупный элемент карточки.
  dateDay: {
    ...typography.titleLg,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text.onDark,
  },
  dateMonth: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.text.onPhotoMuted,
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
});
