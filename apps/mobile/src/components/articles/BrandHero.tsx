import { brandPageLayout, colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Export } from "../icons";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Шапка страницы подборки-бренда в гастрогиде — макет
 * 3z0f6dgev4HMwBAHPjTjPo, node 3425:3926 («Ocean Basket / Mobile / 390»):
 * тёмно-синий кадр со скруглённым низом на 24, круглые кнопки поверх него,
 * пилюля-рубрика и крупное название по центру.
 *
 * ЧТО ЗДЕСЬ ИЗ МАКЕТА, А ЧТО ИЗ ДАННЫХ.
 *
 * Синий градиент (3425:3926) и обе кнопки нарисованы и сделаны как
 * нарисованы. Фирменная графика макета — рыбы, якорь, круг-компас и
 * надпись «Seafood Expedition» шрифтом Lobster — НЕ ВОСПРОИЗВОДИТСЯ: это
 * рисунок ОДНОГО бренда, а экран открывается для любой подборки
 * (`GET /gastroguide/collections/:slug`), и ручки «фирменная графика
 * подборки» в API нет. Вместо неё кадр занимает обложка подборки
 * (`cover_image_url`) поверх того же синего, а название набирается
 * Cormorant Garamond — гарнитурой из макета. Появится поле у бэкенда —
 * графика встанет сюда.
 *
 * СЕРДЕЧКА НЕТ, хотя в макете оно нарисовано (node 3427:12227): избранное
 * на бэкенде знает про заведения, события и акции, но не про подборки.
 * Инертное сердечко из этого приложения уже убирали.
 *
 * Пилюля над названием (node 3425:3935) несёт метку «Подборка» — ту же, что
 * прежде стояла чипом под названием. «КАРТА ПРИКЛЮЧЕНИЙ» из макета —
 * редакционная строка Ocean Basket, и в данных её нет.
 */
export function BrandHero({
  title,
  subtitle,
  coverImageUrl,
  onBack,
  onShare,
}: {
  title: string;
  /** Строка под названием. Пустая — строки просто не будет. */
  subtitle: string;
  coverImageUrl: string | null;
  onBack: () => void;
  onShare: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { height: insets.top + brandPageLayout.heroContentHeight }]}>
      <LinearGradient
        colors={colors.brand2.heroGradient}
        // 103.5° в макете — почти горизонтальный переход с лёгким наклоном
        // вниз. Средняя точка на 56 %, как нарисовано.
        locations={[0, 0.56, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.24 }}
        style={styles.fill}
        pointerEvents="none"
      />
      {/* Обложка подборки лежит ПОВЕРХ синего и приглушена: под ней стоит
          крупное светлое название, и полноцветная фотография съела бы его.
          Обложки нет — остаётся чистый синий из макета, а не плашка «фото
          нет»: пустой прямоугольник посреди фирменного кадра выглядел бы
          поломкой. */}
      {coverImageUrl ? (
        <PhotoView
          uri={coverImageUrl}
          style={styles.cover}
          decorative
          priority="high"
          placeholderIcon={false}
          placeholderColor="transparent"
        />
      ) : null}
      <View style={styles.coverScrim} pointerEvents="none" />

      <View style={[styles.controls, { paddingTop: insets.top + spacing.xxl }]}>
        <BrandHeroControl
          accessibilityLabel={t.a11y.backButton}
          onPress={onBack}
          icon={<ArrowLeft size={24} color={colors.brand2.onNavy} weight="regular" />}
        />
        <BrandHeroControl
          accessibilityLabel={t.a11y.shareButton}
          onPress={onShare}
          icon={<Export size={24} color={colors.brand2.onNavy} weight="regular" />}
        />
      </View>

      <View style={styles.copy}>
        <View style={styles.pill}>
          <Text style={styles.pillLabel} numberOfLines={1}>
            {t.articles.collectionChip.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/** Круглая кнопка 40 поверх шапки (node 3427:12226): подложка белая 30 %,
 * скругление 20. Своя, а не общий `IconButton`: тот делает 44 с чёрным
 * затемнением, а макет здесь рисует 40 с белым. Зона касания добирается
 * `hitSlop`, поэтому правило 44 pt соблюдено.
 *
 * ЭКСПОРТИРУЕТСЯ: ровно эта кнопка стоит и в шапке фирменной страницы
 * Ocean Basket (`components/ocean/OceanHero.tsx`). Второй такой же кнопки в
 * приложении быть не должно — макет рисует одну. */
export function BrandHeroControl({
  icon,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [styles.control, pressed && styles.pressed]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: "space-between",
    overflow: "hidden",
    borderBottomLeftRadius: radius.photoHero,
    borderBottomRightRadius: radius.photoHero,
    backgroundColor: colors.brand2.navy,
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.55,
  },
  coverScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.guide.heroFlatScrim,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: brandPageLayout.contentPaddingHorizontal,
  },
  control: {
    width: brandPageLayout.heroControlSize,
    height: brandPageLayout.heroControlSize,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand2.heroControl,
  },
  pressed: {
    opacity: 0.7,
  },
  copy: {
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: brandPageLayout.contentPaddingHorizontal,
    paddingBottom: brandPageLayout.contentPaddingVertical,
  },
  pill: {
    height: brandPageLayout.heroPillHeight,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.brandPill,
    borderWidth: 1,
    borderColor: colors.brand2.pillBorder,
    backgroundColor: colors.brand2.pillSurface,
  },
  pillLabel: {
    ...typography.brandEyebrow,
    color: colors.brand2.gold,
  },
  title: {
    ...typography.brandTitleLg,
    color: colors.brand2.onNavy,
    textAlign: "center",
  },
  subtitle: {
    ...typography.brandBody,
    color: colors.brand2.gold,
    textAlign: "center",
  },
});
