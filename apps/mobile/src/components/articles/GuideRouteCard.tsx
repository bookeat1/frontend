import type { GuideRoute } from "@bookeat/api";
import { colors, listCard, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Карточка гастропрогулки в секции «Гастропрогулки» экрана гастрогида.
 *
 * Раскладка повторяет карточку подборки (`ArticleListCard`): обложка 148 со
 * скруглением 20, под ней название и одна строка текста. Сделано намеренно
 * одинаково — это соседние карточки одного экрана, и разная типографика читалась
 * бы как сбой, а не как разница смысла.
 *
 * Отличие ровно одно и оно содержательное: под названием стоит `durationLabel`
 * («1 день · 4 точки»), а не описание. Это ГЛАВНОЕ, что человек решает по
 * карточке маршрута: влезает ли он в сегодняшний день. Описание читается уже
 * внутри маршрута.
 *
 * Строку про длительность НЕ СОБИРАЕМ из `pointCount` на клиенте: её пишет
 * редакция, и в ней бывает «вечер» или «2 дня · 7 точек». Считать её самим
 * значило бы выкинуть первую половину. `pointCount` остаётся запасным
 * вариантом на случай, когда редактор строку не заполнил.
 */

/** Высота обложки — та же, что у карточки подборки (`listCard.coverHeight`,
 * 206 из макета 3192:6275; было 148). */
const COVER_HEIGHT = listCard.coverHeight;

export function GuideRouteCard({
  route,
  onPress,
}: {
  route: GuideRoute;
  onPress: (slug: string) => void;
}) {
  const summary = route.durationLabel || t.articles.routePoints(route.pointCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.card(route.title, summary)}
      onPress={() => onPress(route.slug)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PhotoView uri={route.coverImageUrl} style={styles.cover} decorative placeholderIconSize={40} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {route.title}
        </Text>
        <Text style={styles.summary} numberOfLines={1} ellipsizeMode="tail">
          {summary}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  cover: {
    width: "100%",
    height: COVER_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  body: {
    paddingHorizontal: spacing.xs,
    gap: spacing.xxs,
  },
  title: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  summary: {
    ...typography.body,
    color: colors.text.muted,
  },
});
