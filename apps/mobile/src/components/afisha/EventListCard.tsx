import type { EventSummary } from "@bookeat/api";
import { colors, eventListCard, radius, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDayMonth, formatRelativeDateTime, formatTime } from "../../lib/format";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Одна карточка списка «Афиша» (макет 3z0f6dgev4HMwBAHPjTjPo, узлы
 * 3452:13198 / 3452:13199).
 *
 * КАРТОЧКА ПЕРЕРИСОВАНА (правка владельца 2026-08-27, «картиночки стали
 * больше»). Было: обложка 206 сверху, под ней на белом название, подпись и
 * серые метки. Стало: один кадр 198 в высоту, подпись лежит ПОВЕРХ него в
 * нижнем углу, метки на карточке списка больше не рисуются — их место занял
 * сам кадр.
 *
 * Отсюда же исчезли собственные боковые отступы карточки (было 8 у
 * фотографии и 16 у подписи): в новом макете карточка — цельный
 * прямоугольник во всю ширину контейнера, и боковой отступ 16 держит список
 * (`app/events.tsx`), один на все карточки.
 *
 * Как и раньше, вся карточка — одна кнопка, открывающая ЭКРАН СОБЫТИЯ (в
 * отличие от `EventRow` на главной, которая открывает заведение).
 */
export function EventListCard({
  event,
  onPress,
}: {
  event: EventSummary;
  onPress: (eventId: string) => void;
}) {
  const startsAt = new Date(event.startsAt);
  const dayMonth = Number.isNaN(startsAt.getTime()) ? "" : formatDayMonth(startsAt);
  const time = formatTime(event.startsAt);
  const venue = event.restaurant.name || event.venue;
  const subtitle = t.afisha.subtitle([venue, dayMonth, time]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.afisha.card(
        event.title,
        formatRelativeDateTime(event.startsAt),
        event.restaurant.name,
      )}
      onPress={() => onPress(event.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Тень живёт на внешнем `card`, а обрезка по радиусу — на этом слое:
          на iOS `overflow: hidden` и тень на ОДНОМ узле несовместимы, тень
          обрезается вместе с содержимым. */}
      <View style={styles.clip}>
        <PhotoView uri={event.coverImageUrl} style={styles.cover} decorative placeholderIconSize={40} />
        {/* Градиент отдельным слоем поверх фотографии: подпись белая, и на
            светлом кадре без затемнения она пропадает. */}
        <LinearGradient
          colors={colors.overlay.eventCardGradient}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.caption}>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {event.title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: eventListCard.coverHeight,
    borderRadius: radius.eventCard,
    backgroundColor: colors.background.surface,
    // Тень 0/6/20/−6 при 10 % (node 3452:13198). На Android `shadow*` не
    // работает, поэтому рядом стоит `elevation`.
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    elevation: 4,
  },
  clip: {
    flex: 1,
    borderRadius: radius.eventCard,
    // Кадр и градиент скруглены этим слоем — иначе углы фотографии вылезали
    // бы за радиус карточки.
    overflow: "hidden",
    // Подпись прижата к низу кадра.
    justifyContent: "flex-end",
  },
  pressed: {
    opacity: 0.7,
  },
  // Кадр лежит подложкой всей карточки, а подпись и градиент — поверх него.
  cover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.chip,
  },
  caption: {
    paddingHorizontal: eventListCard.contentPadding,
    paddingBottom: eventListCard.contentPadding,
    gap: eventListCard.titleGap,
  },
  title: {
    ...typography.eventCardTitle,
    color: colors.text.onDark,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.onPhotoSubtitle,
  },
});
