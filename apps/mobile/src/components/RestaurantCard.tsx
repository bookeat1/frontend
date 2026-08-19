import type { RestaurantSummary } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatPriceRange } from "../lib/format";
import { openStateLabel } from "../lib/schedule";
import { PhotoView } from "./PhotoView";

interface RestaurantCardProps {
  restaurant: RestaurantSummary;
  onPress: (id: string) => void;
  /**
   * Абсолютно позиционированный элемент ПОВЕРХ фотографии — сегодня это
   * сердечко на экране «Избранные» (макет 602:3630).
   *
   * Слот, а не встроенное сердечко: в каталоге и поиске сердечка на карточке
   * нет, и включать его флагом означало бы тянуть запрос избранного на экраны,
   * которым он не нужен. Вторая карточка заведения ради одной иконки — дефект.
   */
  photoOverlay?: React.ReactNode;
}

const IMAGE_HEIGHT = 148;

/**
 * Search-result card — matches Figma nodes 347:5716–347:5730. The design has
 * no rating/star and no status badge overlaid on the photo: open/closed is a
 * plain text line under the name, and cuisine + price render as chips below
 * the description.
 */
export function RestaurantCard({ restaurant, onPress, photoOverlay }: RestaurantCardProps) {
  const cuisineLabel = restaurant.cuisines.map((c) => c.name).join(", ");
  // Раньше рядом со статусом стояло расстояние («Открыто · 3.4 км»),
  // посчитанное из хеша id заведения. Ни геопозиции гостя, ни расстояния в API
  // нет — строка теперь говорит только то, что мы действительно знаем.
  //
  // «Открыто»/«Закрыто» — серверный `schedule.open_now` (в таймзоне
  // заведения), третье состояние — «часы работы не указаны». Клиент здесь
  // ничего не вычисляет.
  const statusLabel = openStateLabel(restaurant.schedule);

  return (
    <Pressable
      accessibilityRole="button"
      // Скринридер слышит ровно то, что видно глазами.
      accessibilityLabel={[restaurant.name, restaurant.description, cuisineLabel, statusLabel]
        .filter(Boolean)
        .join(", ")}
      onPress={() => onPress(restaurant.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Фото карточки декоративное: всё, что оно говорит, уже сказано в
          accessibilityLabel самой карточки выше. Заведения без фото и
          заведения с отвалившимся фото выглядят одинаково — нейтральная
          плашка, а не дыра в списке. */}
      <View style={styles.imageWrap}>
        <PhotoView
          uri={restaurant.coverPhoto?.uri}
          style={styles.image}
          decorative
          placeholderIconSize={32}
        />
        {/* Слой ровно по границам ФОТОГРАФИИ (обёртка шире неё на 8 с каждой
            стороны): сердечко внутри позиционируется 12/12 от угла снимка,
            как в макете, а не 12 от края обёртки. */}
        {photoOverlay ? (
          <View style={styles.photoOverlayLayer} pointerEvents="box-none">
            {photoOverlay}
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {restaurant.name}
        </Text>
        {/* Venue description, two lines max — the same plain-text field the
            detail screen shows under «О ресторане». Hidden entirely when the
            venue left it blank, rather than leaving a gap. */}
        {restaurant.description ? (
          <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">
            {restaurant.description}
          </Text>
        ) : null}
        <Text style={styles.status}>{statusLabel}</Text>
        <View style={styles.chipsRow}>
          {/* У части заведений в каталоге cuisine_type пустой — тогда чипа
              просто нет, вместо пустого серого прямоугольника. */}
          {cuisineLabel ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{cuisineLabel}</Text>
            </View>
          ) : null}
          <View style={styles.chip}>
            {/* Числовой диапазон среднего чека («4 000–9 000 ₸»), когда бэкенд
                его прислал. У большинства заведений его ещё нет — тогда откат на
                символьную ступень (₸/₸₸/₸₸₸), тот же чип, тот же стиль. */}
            <Text style={styles.chipText}>
              {restaurant.priceRange
                ? formatPriceRange(restaurant.priceRange)
                : restaurant.priceLevel}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  imageWrap: {
    // Фотография отступает от краёв на 8, подпись под ней — на 16 (макет
    // экрана поиска). Отступ живёт на обёртке, а не на самой карточке: иначе
    // он сложился бы с внутренними 16 у текста и получилось бы 24.
    paddingHorizontal: spacing.sm,
  },
  photoOverlayLayer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: spacing.sm,
    right: spacing.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  image: {
    width: "100%",
    height: IMAGE_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  name: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  description: {
    ...typography.body,
    color: colors.text.muted,
  },
  status: {
    ...typography.body,
    color: colors.text.primary,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  chip: {
    backgroundColor: colors.background.chipAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  chipText: {
    ...typography.captionMedium,
    color: colors.text.mutedStrong,
  },
});
