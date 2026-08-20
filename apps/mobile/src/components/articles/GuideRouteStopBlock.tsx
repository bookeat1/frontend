import type { GuideRoutePoint } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRight } from "../icons";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Одна остановка гастропрогулки — белый блок экрана маршрута.
 *
 * ВЕТВИМСЯ ПО `venue`, А НЕ ПО `kind`. `kind` это замысел редакции, а `venue`
 * это то, что реально есть: у точки-заведения заведение пропадает, если его
 * погасили или удалили из каталога. Поэтому карточку-кнопку с шевроном рисуем
 * ровно тогда, когда есть куда вести; иначе остановка остаётся текстом и не
 * притворяется ссылкой. Из маршрута она при этом НЕ исчезает: выкинуть её
 * значило бы молча сократить маршрут, у которого в подписи написано «4 точки».
 *
 * Номер остановки берём из `position`, а не из индекса в массиве: порядок
 * задаёт редакция, и он должен читаться одинаково везде.
 *
 * Фотография: своя у остановки, а если её нет — снимок заведения. У обычного
 * места (парк, базар) второго источника нет, там показывается заглушка
 * `PhotoView`, а не пустое место.
 */
export function GuideRouteStopBlock({
  point,
  onPress,
}: {
  point: GuideRoutePoint;
  onPress: (restaurantId: string) => void;
}) {
  const venue = point.venue;
  const photo = point.photoUrl ?? venue?.imageUrl ?? null;
  // Свой адрес остановки важнее: у заведения он общий, а у точки может быть
  // уточнённый («вход со двора»). Адрес заведения — запасной вариант.
  const address = point.address || venue?.address || "";

  const body = (
    <>
      <View style={styles.headline}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{point.position}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {point.title}
        </Text>
        {venue ? <CaretRight size={20} color={colors.text.muted} /> : null}
      </View>

      <PhotoView uri={photo} style={styles.photo} decorative placeholderIconSize={32} />

      {point.description ? <Text style={styles.description}>{point.description}</Text> : null}
      {address ? <Text style={styles.address}>{address}</Text> : null}
    </>
  );

  if (!venue) {
    return <View style={styles.block}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.openVenue(venue.name)}
      onPress={() => onPress(venue.id)}
      style={({ pressed }) => [styles.block, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.contentBlock,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  headline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  // Номер остановки — кружок с цифрой: маршрут читается как последовательность,
  // и порядковый номер должен быть виден раньше текста.
  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.chip,
  },
  badgeLabel: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  title: {
    ...typography.itemName,
    color: colors.text.strong,
    flex: 1,
  },
  photo: {
    width: "100%",
    height: 148,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  description: {
    ...typography.body,
    color: colors.text.primary,
  },
  address: {
    ...typography.body,
    color: colors.text.muted,
  },
});
