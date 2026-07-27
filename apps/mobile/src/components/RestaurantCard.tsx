import type { RestaurantSummary } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { openStateLabel } from "../lib/schedule";
import { PhotoView } from "./PhotoView";

const t = getDictionary();

interface RestaurantCardProps {
  restaurant: RestaurantSummary;
  onPress: (id: string) => void;
}

const IMAGE_HEIGHT = 148;

/**
 * Search-result card — matches Figma nodes 347:5716–347:5730. The design has
 * no rating/star and no status badge overlaid on the photo: open/closed is a
 * plain text line under the name, and cuisine + price render as chips below
 * the description.
 */
export function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
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
      // Скринридер должен услышать то же, что видно глазами, — включая
      // «только по телефону»: иначе гость узнает об этом на экране брони.
      accessibilityLabel={[
        restaurant.name,
        cuisineLabel,
        statusLabel,
        restaurant.acceptsOnlineBookings ? null : t.restaurant.phoneOnlyBadge,
      ]
        .filter(Boolean)
        .join(", ")}
      onPress={() => onPress(restaurant.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Фото карточки декоративное: всё, что оно говорит, уже сказано в
          accessibilityLabel самой карточки выше. Заведения без фото и
          заведения с отвалившимся фото выглядят одинаково — нейтральная
          плашка, а не дыра в списке. */}
      <PhotoView
        uri={restaurant.coverPhoto?.uri}
        style={styles.image}
        decorative
        placeholderIconSize={32}
      />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {restaurant.name}
        </Text>
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
            {/* NOTE: the mockup shows a tenge price range chip ("12 000-20 000 ₸");
                the schema only carries a symbolic tier, which the app now
                renders in the backend's own alphabet (₸/₸₸/₸₸₸) instead of the
                dollars it used to show. The range itself is still a schema gap. */}
            <Text style={styles.chipText}>{restaurant.priceLevel}</Text>
          </View>
          {/* Карточка не врёт о том, куда ведёт: 17 заведений из 24 в каталоге
              онлайн-бронь не принимают, и узнавать об этом после выбора даты —
              издевательство. Заведение при этом НЕ прячется: оно в каталоге,
              просто с честной меткой. */}
          {!restaurant.acceptsOnlineBookings ? (
            <View style={[styles.chip, styles.chipPhoneOnly]}>
              <Text style={[styles.chipText, styles.chipTextPhoneOnly]}>
                {t.restaurant.phoneOnlyBadge}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
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
  // Не красный: «только по телефону» — это не ошибка и не запрет, а способ
  // забронировать. Тёплый нейтральный тон, тот же, что у статуса «ждём ответа
  // заведения».
  chipPhoneOnly: {
    backgroundColor: colors.status.pendingSurface,
  },
  chipTextPhoneOnly: {
    color: colors.status.pendingText,
  },
});
