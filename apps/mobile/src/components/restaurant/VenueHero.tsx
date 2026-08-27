import type { Restaurant } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Export, Heart, type IconProps } from "../icons";
import { PhotoView } from "../PhotoView";
import { cuisineLine } from "../../lib/cuisine-display";
import { formatPriceRange } from "../../lib/format";

const t = getDictionary();

/**
 * Шапка карточки заведения — «Hero / Editorial» из макета
 * (Figma 3z0f6dgev4HMwBAHPjTjPo, node 3446:12620).
 *
 * Что изменилось против прежней шапки (правка владельца 2026-08-27
 * «карточка ресторана изменилась, шапка изменилась, кнопки поделиться,
 * лайк»):
 *
 *  - снимок идёт ОТ КРАЯ ДО КРАЯ и на 350 в высоту; раньше он отступал от
 *    краёв на 8 и был 240;
 *  - «назад», «нравится» и «поделиться» лежат НА снимке полупрозрачными
 *    кругами 40; раньше они стояли в белой полосе НАД ним;
 *  - имя места, подпись и метки — тоже на снимке, у нижнего края; раньше они
 *    были чёрным по белому под фотографией;
 *  - читаемость держит вертикальный градиент (node 3446:12623), а не белый
 *    фон.
 *
 * Чего в макете нет и здесь тоже нет: расстояния «500 м» в подписи (нет ни
 * геопозиции гостя, ни расстояния в API) и меток-тегов вида «Гастрогид» /
 * «Морепродукты» (у заведения нет такого поля). Метка на снимке остаётся
 * одна — оценка, и только когда отзывы действительно есть.
 *
 * Адрес из шапки ушёл вместе с прежней вёрсткой: в макете его здесь нет, а на
 * экране он остался там, где ему и место, — в блоке контактов рядом с картой.
 */
export function VenueHero({
  restaurant,
  isFavorite,
  onToggleFavorite,
  onBack,
  onShare,
}: {
  restaurant: Restaurant;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
  onShare: () => void;
}) {
  const insets = useSafeAreaInsets();
  const price = restaurant.priceRange ? formatPriceRange(restaurant.priceRange) : "";
  const subtitle = [cuisineLine(restaurant.cuisines), price].filter(Boolean).join(" · ");

  return (
    <View style={styles.root}>
      {/* Белая полоса под статус-баром — она же верх «Hero / Editorial»
          (node 3446:12621). Высота берётся с устройства, а не из макета: 44
          там — статус-бар КОНКРЕТНОГО телефона, на реальных он от 20 до 62. */}
      <View style={[styles.statusBarFloor, { height: insets.top }]} />
      <View style={styles.photoFrame}>
        <PhotoView
          uri={restaurant.coverPhoto?.uri}
          alt={restaurant.coverPhoto?.alt}
          style={styles.photo}
          transition={200}
          priority="high"
          placeholderIconSize={40}
        />
        {/* Градиент из макета: прозрачный сверху, 10% на половине высоты,
            чёрный внизу. Средняя точка обязательна — без неё на однотонном
            зале переход виден полосой. */}
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

        <View style={styles.controls}>
          <HeroButton icon={ArrowLeft} label={t.a11y.backButton} onPress={onBack} />
          <View style={styles.controlsRight}>
            <HeroButton
              icon={Heart}
              label={
                isFavorite
                  ? t.restaurant.favoriteRemove(restaurant.name)
                  : t.restaurant.favoriteAdd(restaurant.name)
              }
              onPress={onToggleFavorite}
              checked={isFavorite}
            />
            <HeroButton icon={Export} label={t.a11y.shareButton} onPress={onShare} />
          </View>
        </View>

        <View style={styles.caption}>
          <View style={styles.captionText}>
            <Text style={styles.name}>{restaurant.name}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {/* Оценку показываем, только когда отзывы реально есть: «0,0» у
              заведения без отзывов читается как плохая оценка. */}
          {restaurant.reviewsCount > 0 ? (
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {`${t.restaurant.rating(restaurant.rating)} · ${t.restaurant.reviewsCount(restaurant.reviewsCount)}`}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Круглая кнопка НА снимке — 40 со значком 24 и белой подложкой 20%
 * (node 3446:12630). Не `IconButton`: тот 44 с прозрачной или тёмной
 * подложкой и без состояния «включено», а сердечку нужен `checked` и залитый
 * глиф. Недостающие до 44 четыре точки добирает hitSlop.
 */
function HeroButton({
  icon: Icon,
  label,
  onPress,
  checked,
}: {
  icon: React.ComponentType<IconProps>;
  label: string;
  onPress: () => void;
  checked?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={checked === undefined ? undefined : { checked }}
      onPress={onPress}
      hitSlop={(44 - HERO_BUTTON_SIZE) / 2}
      style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
    >
      <Icon
        size={24}
        weight={checked ? "fill" : "regular"}
        color={checked ? colors.brand.favorite : colors.text.onDark}
      />
    </Pressable>
  );
}

/** 40x40 со скруглением 20 — node 3446:12630. */
const HERO_BUTTON_SIZE = 40;
/** Высота снимка — 350 (node 3446:12622). Было 240. */
const HERO_PHOTO_HEIGHT = 350;
/** Кнопки стоят в 58 от верха кадра, из которых 44 — статус-бар макета: под
 * безопасной зоной остаётся 14. */
const CONTROLS_TOP = 14;
/** Подпись отбита от нижнего края снимка на 22: в макете её блок начинается
 * на 268 при высоте кадра 350, а сам блок 104 высотой. */
const CAPTION_BOTTOM = 22;

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background.surface,
  },
  statusBarFloor: {
    backgroundColor: colors.background.surface,
  },
  photoFrame: {
    height: HERO_PHOTO_HEIGHT,
    borderRadius: radius.hero,
    overflow: "hidden",
  },
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: colors.background.chip,
  },
  controls: {
    position: "absolute",
    top: CONTROLS_TOP,
    // 16 от краёв кадра (node 3446:12624: `left-[16px]`, ширина 343 при 375).
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlsRight: {
    flexDirection: "row",
    // 8 между «нравится» и «поделиться» (node 3446:12629: `gap-[8px]`).
    gap: spacing.sm,
  },
  heroButton: {
    width: HERO_BUTTON_SIZE,
    height: HERO_BUTTON_SIZE,
    borderRadius: HERO_BUTTON_SIZE / 2,
    backgroundColor: colors.overlay.photoControl,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  caption: {
    position: "absolute",
    left: spacing.xxl,
    right: spacing.xxl,
    bottom: CAPTION_BOTTOM,
    // 12 между текстом и рядом меток (node 3446:12638: `gap-[12px]`).
    gap: spacing.md,
  },
  captionText: {
    // 4 между именем и подписью (node 3446:12639: `gap-[4px]`).
    gap: spacing.xs,
  },
  name: {
    ...typography.displayHero,
    color: colors.text.onDark,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.onDark,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    // 6 между метками (node 3452:13281: `gap-[6px]`); шага 6 в шкале нет.
    gap: spacing.xs + 2,
  },
  // Метка на снимке: белая подложка 20%, поля 12/7, подпись 12/16
  // (node 3452:13282). Бордовой заливки меток из прежней шапки здесь нет —
  // на фотографии она читалась бы как кнопка.
  pill: {
    backgroundColor: colors.overlay.photoControl,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  pillText: {
    ...typography.captionMedium,
    color: colors.text.onDark,
  },
});
