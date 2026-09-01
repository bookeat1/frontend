import type { Booking } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRestaurantSummary } from "../../hooks/useRestaurant";
import { venueSubtitle } from "../../lib/cuisine-display";
import { formatRelativeDateTime } from "../../lib/format";
import { MapPin, Users } from "../icons";
import { PhotoView } from "../PhotoView";
import { toneForStatus } from "./BookingStatusPill";

const t = getDictionary();

/**
 * Одна строка списка «Брони» (Figma 3z0f6dgev4HMwBAHPjTjPo: активная бронь —
 * node 3589:8205, прошедшая — node 3589:8370).
 *
 * ПЕРЕРИСОВАНА 2026-09-01. Было: серая плашка `background.subtle` со
 * скруглением 24, квадратный снимок 64×64 слева, название, крупная строка
 * «когда», пилюля статуса в углу, линия и ряд фактов под ней. Стало: карточка
 * ЦЕЛИКОМ снимок заведения — как в каталоге, в избранном и в афише, — с
 * фактами в стеклянных пилюлях поверх фотографии.
 *
 * Два вида одной карточки, потому что их два в макете:
 *
 *  - `active` (node 3589:8231) — высота 170, снимок гасится градиентом
 *    (прозрачный → 20 % → 86 %), сверху пилюли «гости» и адрес, снизу
 *    «Заведение · когда» и строка «кухня · чек». Карточка лежит в рамке со
 *    скруглением 24, залитой ЦВЕТОМ СТАТУСА и выглядывающей снизу полосой 6;
 *  - `past` (node 3589:8529) — высота 93, снимок гасится РОВНЫМ чёрным 60 %,
 *    строка «Заведение · когда» и под ней те же пилюли. Ни полосы статуса, ни
 *    строки «кухня · чек» в макете здесь нет.
 *
 * ЧТО ЭТА ПРАВКА ЗАБРАЛА У ГОСТЯ, и это надо знать: видимой ПОДПИСИ статуса
 * («Ждёт подтверждения», «Отменена») на карточке больше нет — в новом макете
 * статус несёт только цвет полосы, а у прошедшей брони и полосы нет. Для
 * скринридера статус остался: он ушёл в `accessibilityLabel` карточки. Для
 * глаза он читается на экране самой брони, где `BookingStatusPill` не
 * тронута. Различать «отменена» и «состоялась» в истории на глаз теперь
 * нельзя — это вопрос к макету, а не то, что можно дорисовать самому.
 *
 * Ни названия, ни фотографии, ни адреса, ни кухни в ответе `GET /bookings`
 * нет — он несёт только `restaurant_id`. Всё это читает тот же
 * запрос-сводка `["restaurant-summary", id]`, что и раньше (React Query
 * дедуплицирует, FlatList монтирует только видимые строки). Пока сводка не
 * пришла или упала, название честно подменяется служебной строкой, а адрес,
 * подпись и снимок просто не рисуются: бронь с чужим адресом хуже брони без
 * адреса.
 */
export function BookingListCard({
  booking,
  variant = "active",
  onPress,
}: {
  booking: Booking;
  /**
   * `active` — вкладка «Активные», `past` — «История». Вид приносит ЭКРАН, а
   * не карточка: он один знает, в какое ведро бронь попала (`isPastBooking`
   * смотрит и на статус, и на время окончания), и раскладывать бронь дважды
   * по разным правилам — верный способ получить два разных ответа.
   */
  variant?: "active" | "past";
  onPress: (bookingId: string) => void;
}) {
  const restaurant = useRestaurantSummary(booking.restaurantId);

  const venueName = restaurant.data?.name;
  const venueLabel = venueName
    ? venueName
    : restaurant.isError
      ? t.myBookings.venueUnavailable
      : t.myBookings.venueLoading;
  const address = restaurant.data?.address;

  const when = formatRelativeDateTime(booking.startsAt);
  const guests = t.booking.guestsCount(booking.guests);
  const statusLabel = t.booking.status[booking.status];
  const past = variant === "past";

  // «Flour Demi · 9 июня, 10:30» одной строкой — в макете имя места и время
  // стоят вместе (node 3589:8247). Дата НАША, а не из макета: там нарисовано
  // «Июнь 9, 10:30», по-русски так не пишут, и формат живёт в `format.ts`.
  const title = `${venueLabel} · ${when}`;
  // «Европейская · ₸₸₸» — тот же помощник, что под названием на карточке
  // каталога: одно место обязано подписываться одинаково во всех списках.
  const subtitle = restaurant.data
    ? venueSubtitle(restaurant.data.cuisines[0]?.name ?? "", restaurant.data.priceLevel)
    : "";

  const pills = (
    <View style={styles.pills}>
      <Pill icon={<Users size={PILL_ICON_SIZE} color={colors.text.onDark} weight="regular" />}>
        {guests}
      </Pill>
      {address ? (
        <Pill icon={<MapPin size={PILL_ICON_SIZE} color={colors.text.onDark} weight="regular" />}>
          {address}
        </Pill>
      ) : null}
    </View>
  );

  const card = (
    <Pressable
      accessibilityRole="button"
      // Статус звучит здесь, потому что видимой подписи у него больше нет.
      accessibilityLabel={`${t.myBookings.openBooking(venueLabel, when)}, ${t.booking.statusLabel}: ${statusLabel}`}
      onPress={() => onPress(booking.id)}
      style={({ pressed }) => [styles.card, past && styles.cardPast, pressed && styles.pressed]}
    >
      {/* Тень живёт на внешнем View, обрезка — на внутреннем: `overflow:
          hidden` на том же элементе, что и тень, срезает саму тень. Тот же
          приём, что в `ListMediaCard`. */}
      <View style={styles.clip}>
        <PhotoView
          uri={restaurant.data?.coverPhoto?.uri}
          style={styles.cover}
          decorative
          placeholderIconSize={32}
        />
        {past ? (
          // Ровная заливка, а не градиент: на карточке 93 текст стоит и
          // сверху, и снизу.
          <View style={[StyleSheet.absoluteFill, styles.flatScrim]} pointerEvents="none" />
        ) : (
          <LinearGradient
            colors={[
              colors.overlay.listCardScrimTop,
              colors.overlay.listCardScrimMid,
              colors.overlay.listCardScrimBottom,
            ]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}

        <View style={[styles.content, past && styles.contentPast]}>
          {past ? (
            <>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {title}
              </Text>
              {pills}
            </>
          ) : (
            <>
              {pills}
              <View style={styles.headline}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );

  // Полоса статуса — только у активной брони: в макете у карточки истории её
  // нет, а «серая полоска ни о чём» была бы худшим из двух вариантов.
  const stripColor = past ? null : stripColorForStatus(booking.status);
  if (!stripColor) return card;

  return <View style={[styles.strip, { backgroundColor: stripColor }]}>{card}</View>;
}

/**
 * Цвет полосы под карточкой. Тон берём у ТОГО ЖЕ помощника, что и пилюля
 * статуса, — иначе список и деталка брони однажды разойдутся в том, что
 * считать «подтверждено».
 *
 * `negative` и `neutral` возвращают null не от лени: во вкладке «Активные»
 * таких броней не бывает (отменённая и завершённая уезжают в историю), а
 * придумывать им цвет, которого нет в макете, значит рисовать гостю то, чего
 * дизайнер не говорил.
 */
function stripColorForStatus(status: Booking["status"]): string | null {
  switch (toneForStatus(status)) {
    case "positive":
      return colors.status.stripPositive;
    case "pending":
      return colors.status.stripPending;
    case "negative":
    case "neutral":
      return null;
  }
}

/** Стеклянная пилюля поверх снимка: глиф 20 и подпись 12/20 (node 3589:8234). */
function Pill({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <View style={styles.pill}>
      {icon}
      <Text style={styles.pillLabel} numberOfLines={1} ellipsizeMode="tail">
        {children}
      </Text>
    </View>
  );
}

/** Глифы в пилюлях — 20×20 (узлы 3589:8235, 3589:8242). */
const PILL_ICON_SIZE = 20;
/** Поле пилюли сверху и снизу — 6, вне 4pt-шкалы. */
const PILL_PADDING_VERTICAL = 6;
/** Высота карточки активной брони — 170 (node 3589:8231). */
const CARD_HEIGHT_ACTIVE = 170;
/** Высота карточки прошедшей брони — 93 (node 3589:8529). */
const CARD_HEIGHT_PAST = 93;
/** Полоса статуса, выглядывающая снизу, — 6 (node 3589:8230: `pb-[6px]`). */
const STRIP_HEIGHT = 6;
/**
 * Правое поле содержимого — 2 (узлы 3589:8232 и I3589:8529;3589:8486:
 * `pl-[16px] pr-[2px]`). Значение макета, не описка кода: слева 16, справа 2,
 * поэтому длинная строка обрывается почти у самого края.
 */
const CONTENT_PADDING_RIGHT = 2;

const styles = StyleSheet.create({
  strip: {
    borderRadius: radius.bookingCard,
    paddingBottom: STRIP_HEIGHT,
  },
  card: {
    height: CARD_HEIGHT_ACTIVE,
    borderRadius: radius.listCard,
    // Тень из макета `0px 6px 20px -6px rgba(0,0,0,0.1)`. Отрицательный
    // spread в RN не выражается, поэтому радиус вдвое меньше нарисованного —
    // пятно выходит примерно того же размера. Android умеет только elevation.
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPast: {
    height: CARD_HEIGHT_PAST,
  },
  pressed: {
    opacity: 0.9,
  },
  clip: {
    flex: 1,
    borderRadius: radius.listCard,
    overflow: "hidden",
    backgroundColor: colors.background.chip,
  },
  cover: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  flatScrim: {
    backgroundColor: colors.overlay.photoFlatScrim,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingLeft: spacing.lg,
    paddingRight: CONTENT_PADDING_RIGHT,
    paddingVertical: spacing.md,
  },
  contentPast: {
    // У прошедшей брони содержимое не разгоняется по краям: заголовок и
    // пилюли стоят подряд с просветом 12 (node I3589:8529;3589:8487).
    justifyContent: "flex-start",
    gap: spacing.md,
  },
  headline: {
    // 2 между строкой заголовка и подписью (node 3589:8246: `gap-[2px]`).
    gap: 2,
  },
  title: {
    ...typography.bookingCardTitle,
    color: colors.text.onDark,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.onDarkMuted,
  },
  pills: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    // Адрес в 360 px не влезает рядом с гостями целиком — пилюля сжимается и
    // обрезает подпись, а не выталкивает соседку за край карточки.
    flexShrink: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    // 4 между глифом и подписью (node 3589:8234: `gap-[4px]`).
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    // 6 сверху и снизу (node 3589:8234: `py-[6px]`) — шага 6 в шкале нет.
    paddingVertical: PILL_PADDING_VERTICAL,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay.photoPill,
    flexShrink: 1,
  },
  pillLabel: {
    ...typography.caption,
    // 12/20 из макета — на ступень свободнее, чем общий `caption` (12/16):
    // подпись стоит рядом с глифом 20 и должна быть с ним одной высоты.
    lineHeight: 20,
    color: colors.text.onDark,
    flexShrink: 1,
  },
});
