import type { Booking, Restaurant } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Top card of the Reservation detail screen (Figma «BookEat (Copy) (Copy)»,
 * страница «🟢 Готово к разработке», node `5504:7508` → `5504:7512`/`5504:7513`
 * — состояние «подтверждена + есть предзаказ», REST-спека сохранена в
 * `/tmp/spec-booking-confirmed-preorder.md`).
 *
 * БЫЛО: карточка 72×72 с именем/адресом по центру на белом фоне (node
 * 488:9876). Правка заменяет её фотографией заведения (343×323, вписана в
 * белую карточку с полями 16, а не во весь экран под статус-бар — этим этот
 * узел отличается от шапки экрана «Подтверждение брони», см.
 * `ConfirmationHero`, чей ПАТТЕРН — фото + стеклянные пилюли — здесь
 * переиспользован, а не скопирован 1-в-1: там фото full-bleed и есть кнопки
 * назад/закрыть, здесь фото с полями и кнопок в шапке нет вовсе).
 *
 * Стеклянные подложки (бейдж/пилюли) — `colors.overlay.confirmHeroGlass`,
 * НЕ настоящее размытие: `expo-blur` в проект не поставлен (см. комментарий у
 * токена и `ConfirmationHero`).
 */
export function ReservationHeaderCard({
  booking,
  restaurant,
  guestsLabel,
  dateLabel,
  timeLabel,
  /** Есть ли у брони предзаказ — единственное, что решает, показывать ли
   * зелёный бейдж «Предзаказ подтверждён» вместо обычного статуса. Экран
   * знает число позиций предзаказа, а эта карточка — только рисует. */
  hasPreorder,
  actions,
}: {
  booking: Booking;
  restaurant?: Restaurant;
  guestsLabel: string;
  dateLabel: string;
  timeLabel: string;
  hasPreorder: boolean;
  /** Ряд кнопок под фото. Их рисует экран: он знает, можно ли отменить/куда вести. */
  actions?: React.ReactNode;
}) {
  const photoUri = restaurant?.coverPhoto?.uri;
  // Зелёный бейдж — ТОЛЬКО «подтверждена и есть предзаказ» (node 5504:7634/
  // 7635): это отдельная от статуса брони мысль («и есть заказ»), а не
  // редизайн статуса. Любое другое сочетание статус/предзаказ показывает
  // обычный перевод статуса брони той же стеклянной пилюлей — в макете нет
  // кадров для pending/cancelled/etc. на этом узле, но статус обязан быть
  // виден в любом состоянии, а не только в этом одном.
  const showConfirmedPreorderBadge = booking.status === "confirmed" && hasPreorder;
  const badgeLabel = showConfirmedPreorderBadge ? t.booking.confirmedPreorderBadge : t.booking.status[booking.status];

  return (
    <View style={styles.card}>
      <View style={styles.photoFrame}>
        <PhotoView
          uri={photoUri}
          alt={restaurant?.coverPhoto?.alt}
          style={styles.photo}
          decorative
          priority="high"
          placeholderIconSize={40}
        />
        {/* Тот же градиент, что и в шапке карточки заведения и в
            `ConfirmationHero` — держит белый текст читаемым на любом снимке. */}
        <LinearGradient
          colors={[
            colors.overlay.venueHeroScrimTop,
            colors.overlay.venueHeroScrimMid,
            colors.overlay.venueHeroScrimBottom,
          ]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.content}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, showConfirmedPreorderBadge && styles.badgeConfirmedPreorder]}>
              <Text
                style={styles.badgeLabel}
                numberOfLines={1}
                accessibilityLabel={`${t.booking.statusLabel}: ${badgeLabel}`}
              >
                {badgeLabel}
              </Text>
            </View>
          </View>

          <View style={styles.caption}>
            <View style={styles.captionText}>
              {restaurant?.name ? (
                // Длинные русские названия реальны — до двух строк, потом многоточие.
                <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
                  {restaurant.name.trim()}
                </Text>
              ) : null}
              {restaurant?.address ? (
                <Text style={styles.address} numberOfLines={1} ellipsizeMode="tail">
                  {restaurant.address}
                </Text>
              ) : null}
            </View>
            <View style={styles.pillRow}>
              <GlassPill>{guestsLabel}</GlassPill>
              <GlassPill>{dateLabel}</GlassPill>
              <GlassPill>{timeLabel}</GlassPill>
            </View>
          </View>
        </View>
      </View>

      {/* Ряд действий («На главную»/«Забронировать снова» + «Меню») — под
          фото, на белом фоне карточки (node 5504:7529/7530/7531), а не поверх
          снимка. Экран уже рисует их своим `actionsRow` (тот же просвет 12,
          что и в макете) — здесь только слот, без второй обёртки-строки. */}
      {actions}
    </View>
  );
}

/** Пилюля «N гостей»/дата/время — тот же вид, что у `ConfirmationHero`
 * (узлы 5504:7523/7525/7527). */
function GlassPill({ children }: { children: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** Высота фото-кадра — 323 (node 5504:7513), фиксированная: в отличие от
 * `ConfirmationHero` этот кадр НЕ уходит под статус-бар и не зависит от
 * `insets.top` — он живёт внутри обычной прокручиваемой карточки. */
const PHOTO_HEIGHT = 323;
/** Поле пилюли сверху/снизу — 7, вне 4pt-шкалы (узел 5504:7523: `py-[7px]`),
 * то же значение, что и в `ConfirmationHero`. */
const PILL_PADDING_VERTICAL = 7;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    // Флеш с верхом списка (карточка первая в прокрутке) — верхние углы
    // квадратные, нижние скруглены, как у прежней шапки (`corners="bottom"`
    // у `BookingCard`).
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  photoFrame: {
    height: PHOTO_HEIGHT,
    borderRadius: radius.photoHero,
    overflow: "hidden",
    backgroundColor: colors.background.chip,
  },
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  // 183×40, паддинг 8/12 (узел 5504:7634).
  badge: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay.confirmHeroGlass,
  },
  badgeConfirmedPreorder: {
    backgroundColor: colors.status.confirmedPreorderBadge,
  },
  badgeLabel: {
    ...typography.heroCapsuleLabel,
    color: colors.text.onDark,
  },
  caption: {
    gap: spacing.md,
  },
  captionText: {
    gap: spacing.xs,
  },
  name: {
    ...typography.displayHero,
    color: colors.text.onDark,
  },
  address: {
    ...typography.body,
    color: colors.text.onDark,
  },
  pillRow: {
    flexDirection: "row",
    gap: spacing.xs + 2,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: PILL_PADDING_VERTICAL,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay.confirmHeroGlass,
  },
  pillLabel: {
    ...typography.captionMedium,
    color: colors.text.onDark,
  },
});
