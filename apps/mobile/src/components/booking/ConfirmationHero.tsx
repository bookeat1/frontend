import type { Restaurant } from "@bookeat/api";
import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, X, type IconProps } from "../icons";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Шапка экрана «Подтверждение брони» — фото заведения во весь экран, поверх
 * него стеклянные «назад» / «Подтверждение» / закрыть и, у нижнего края,
 * название с адресом и ряд пилюль «гости · дата · время» (Figma
 * «BookEat (Copy) (Copy)», страница «🟢 Готово к разработке», node
 * `918:13021`, кадр `5482:13902` со вложенными `5482:13903`/`5504:7282`).
 *
 * Было: карточка 64×64 с именем и адресом по центру на белом фоне
 * (`ConfirmBookingScreen.venueHeader` до этой правки) — обычный `FlowHeader`
 * НАД ней. Правка убирает обе: и маленькое фото, и белую шапку, — фотография
 * теперь несёт то, что раньше несла белая полоса сверху.
 *
 * Фото уходит ПОД статус-бар, как и у остальных полноразмерных шапок этого
 * приложения (`BrandHero`, `GuideHero`, `OceanHero`): высота считается как
 * `insets.top + HERO_CONTENT_HEIGHT`, а кнопки отступают от верха на
 * `insets.top + spacing.lg`. Отдельной белой полосы под статус-баром здесь
 * специально нет (в отличие от `VenueHero`) — в новом макете статус-бар
 * рисуется поверх самого снимка.
 *
 * Стеклянные подложки кнопок/капсулы/пилюль — `colors.overlay.confirmHeroGlass`,
 * НЕ настоящее размытие: `expo-blur` в проект не поставлен (см. комментарий
 * у токена и `lib/glass-effect.ts`).
 */
export function ConfirmationHero({
  restaurant,
  guestsLabel,
  dateLabel,
  timeLabel,
  onBack,
  onClose,
}: {
  restaurant: Pick<Restaurant, "name" | "address" | "coverPhoto">;
  guestsLabel: string;
  dateLabel: string;
  timeLabel: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { height: insets.top + HERO_CONTENT_HEIGHT }]}>
      <PhotoView
        uri={restaurant.coverPhoto?.uri}
        alt={restaurant.coverPhoto?.alt}
        style={styles.photo}
        decorative
        priority="high"
        placeholderIconSize={40}
      />
      {/* Тот же градиент, что и в шапке карточки заведения (node 3446:12623):
          прозрачный сверху, 10 % на половине высоты, чёрный внизу — держит
          белый текст читаемым на любом снимке зала. */}
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

      <View style={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.controls}>
          <HeroGlassButton icon={ArrowLeft} label={t.a11y.backButton} onPress={onBack} />
          <View style={styles.titleCapsule}>
            <Text style={styles.titleLabel} numberOfLines={1}>
              {t.booking.confirmTitle}
            </Text>
          </View>
          <HeroGlassButton icon={X} label={t.a11y.closeButton} onPress={onClose} />
        </View>

        <View style={styles.caption}>
          <View style={styles.captionText}>
            <Text style={styles.name} numberOfLines={2}>
              {restaurant.name}
            </Text>
            <Text style={styles.address} numberOfLines={1} ellipsizeMode="tail">
              {restaurant.address}
            </Text>
          </View>
          <View style={styles.pillRow}>
            <GlassPill>{guestsLabel}</GlassPill>
            <GlassPill>{dateLabel}</GlassPill>
            <GlassPill>{timeLabel}</GlassPill>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Круглая стеклянная кнопка 40×40 (узлы 5482:13905/5482:13911) — hitSlop
 * добирает зону касания до 44. */
function HeroGlassButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<IconProps>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={(hitSlop.minTouchTarget - HERO_BUTTON_SIZE) / 2}
      style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
    >
      <Icon size={24} color={colors.text.onDark} weight="regular" />
    </Pressable>
  );
}

/** Пилюля «N гостей»/дата/время (узлы 5504:7288, 5504:7290, 5504:7292). */
function GlassPill({ children }: { children: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** Высота кадра шапки БЕЗ статус-бара — 323 (node 5482:13902). */
const HERO_CONTENT_HEIGHT = 323;
/** Круглые кнопки — 40×40 (узлы 5482:13905, 5482:13911). */
const HERO_BUTTON_SIZE = 40;
/** Поле пилюли сверху/снизу — 7, вне 4pt-шкалы (узел 5504:7288: `py-[7px]`). */
const PILL_PADDING_VERTICAL = 7;

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderBottomLeftRadius: radius.photoHero,
    borderBottomRightRadius: radius.photoHero,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroButton: {
    width: HERO_BUTTON_SIZE,
    height: HERO_BUTTON_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay.confirmHeroGlass,
  },
  pressed: {
    opacity: 0.7,
  },
  // 126×40, паддинг 8/12 (узел 5482:13908).
  titleCapsule: {
    height: HERO_BUTTON_SIZE,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay.confirmHeroGlass,
  },
  titleLabel: {
    ...typography.heroCapsuleLabel,
    color: colors.text.onDark,
  },
  // 12 между текстом и рядом пилюль (узел 5504:7283: gap 12).
  caption: {
    gap: spacing.md,
  },
  // 4 между названием и адресом (узел 5504:7284: gap 4).
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
  // 6 между пилюлями (узел 5504:7287: gap 6) — шага 6 в шкале нет.
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
