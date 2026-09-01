import { colors, oceanPageLayout, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { BrandHeroControl } from "../articles/BrandHero";
import { Anchor, ArrowLeft, Export, Gift } from "../icons";
import { oceanAssets } from "./ocean-basket-content";
import { OceanHeroFish } from "./OceanHeroFish";

const t = getDictionary();

/**
 * ШАПКА фирменной страницы Ocean Basket — макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 3425:3926: синий градиент со скруглённым низом, свечение за надписью,
 * пилюля «КАРТА ПРИКЛЮЧЕНИЙ», фирменная надпись «Seafood Expedition» и плашка
 * «WELCOME DRINK».
 *
 * ЭТО НЕ `BrandHero`. Тот рисует ЛЮБУЮ подборку гастрогида: обложка из API,
 * название и подпись текстом. Здесь всё нарисовано под один бренд — надпись
 * шрифтом Lobster (его в приложении нет, поэтому это картинка-экспорт из
 * макета), рыбы по краям, свечение, промо-плашка. Общего у них ровно одно —
 * круглая кнопка поверх шапки, и она ОДНА на два экрана (`BrandHeroControl`).
 *
 * ЧЕГО ЗДЕСЬ НЕТ ИЗ МАКЕТА, НАМЕРЕННО:
 *
 *   • СЕРДЦЕ (node 3427:12227). Избранное на бэкенде знает заведения, события
 *     и акции; страницы бренда оно не знает. Инертное сердечко из этого
 *     приложения уже убирали однажды — второй раз заводить не будем.
 *   • «ПОДРОБНЕЕ» И ШЕВРОН у плашки welcome drink (node 3425:3949) — разбор
 *     ниже;
 *   • ничего больше: рыбы, свечение, надпись и сама плашка на месте.
 *
 * ПЛАШКА «WELCOME DRINK» — ОФОРМЛЕНИЕ, А НЕ ПРЕДЛОЖЕНИЕ (решение владельца
 * 2026-09-01: «оставляй её картинкой без обещания»). Акции welcome drink в
 * данных нет: ни у подборки, ни у заведения такого поля не существует, у брони
 * нет признака напитка, и заведение о ней не знает. Поэтому плашка нарисована
 * ровно как в макете, но:
 *
 *   • не нажимается — это `View` c `pointerEvents="none"`, а не `Pressable`;
 *   • без «Подробнее» и шеврона (node 3425:3949) вместе с разделителем,
 *     который их отделял: разделитель существовал ради действия, которого
 *     больше нет.
 *
 * Строка «Welcome drink» остаётся фирменной надписью бренда в шапке. Значок
 * акции с карточек точек убран совсем (`OceanPointCard`): там он читался как
 * гарантия по конкретному заведению.
 */
export function OceanHero({
  onBack,
  onShare,
}: {
  onBack: () => void;
  onShare: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { height: insets.top + oceanPageLayout.heroHeight }]}>
      <LinearGradient
        colors={colors.brand2.heroGradient}
        // Те же три точки и тот же наклон, что у шапки подборки (node
        // 3425:3926): 103.5°, средняя точка на 56 %.
        locations={[0, 0.56, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.24 }}
        style={styles.fill}
        pointerEvents="none"
      />

      {/* Свечение за надписью (node 3425:3927) — радиальный градиент, а не
          картинка: два цвета и две точки описываются точно, а PNG круга на
          390 pt весил бы больше самой надписи. */}
      <View
        style={[styles.glow, { top: insets.top + oceanPageLayout.heroGlowTop }]}
        pointerEvents="none"
      >
        <Svg width={oceanPageLayout.heroGlowSize} height={oceanPageLayout.heroGlowSize}>
          <Defs>
            <RadialGradient id="oceanHeroGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.brand2.heroGlowStart} />
              <Stop offset="1" stopColor={colors.brand2.heroGlowEnd} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={oceanPageLayout.heroGlowSize / 2}
            cy={oceanPageLayout.heroGlowSize / 2}
            r={oceanPageLayout.heroGlowSize / 2}
            fill="url(#oceanHeroGlow)"
          />
        </Svg>
      </View>

      {/* Рыбы-силуэты (узлы 3443:12520…3443:12528) — контуры выгружены из
          макета, см. OceanHeroFish. */}
      <OceanHeroFish offsetTop={insets.top} />

      {/* Кнопки поверх шапки: 26 от верха кадра (node 3427:12220), поля 20. */}
      <View style={[styles.controls, { top: insets.top + CONTROLS_TOP }]}>
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

      <View style={[styles.pill, { top: insets.top + oceanPageLayout.heroPillTop }]}>
        <Anchor size={16} color={colors.brand2.gold} weight="regular" />
        <Text style={styles.pillLabel} numberOfLines={1}>
          {t.oceanBasket.heroEyebrow}
        </Text>
      </View>

      {/* Надпись бренда — ДВЕ картинки, а не текст: в макете это Lobster,
          которого в сборке нет и который ради одной страницы не подключаем
          (лишний шрифт в каждом обновлении приложения). Обе выгружены из
          макета как есть. */}
      <Image
        source={oceanAssets.letteringSeafood}
        style={[styles.seafood, { top: insets.top + oceanPageLayout.heroSeafoodTop }]}
        contentFit="contain"
        accessibilityLabel="Seafood Expedition"
      />
      {/* Подпись для скринридера несёт ПЕРВАЯ половина надписи: иначе он
          прочитает «Seafood Expedition» дважды. */}
      <Image
        source={oceanAssets.letteringExpedition}
        style={[styles.expedition, { top: insets.top + oceanPageLayout.heroExpeditionTop }]}
        contentFit="contain"
      />

      {/* Оформление, а не кнопка: нажать не на что и вести отсюда некуда.
          `pointerEvents="none"` — чтобы плашка ещё и не перехватывала касание
          у прокрутки. Скринридер читает надпись как обычный текст. */}
      <View
        style={[styles.welcome, { top: insets.top + oceanPageLayout.welcomeTop }]}
        pointerEvents="none"
      >
        <View style={styles.welcomeIcon}>
          <Gift size={14} color={colors.brand2.navyInk} weight="regular" />
        </View>
        <Text style={styles.welcomeLabel} numberOfLines={1}>
          {t.oceanBasket.welcomeDrink}
        </Text>
      </View>
    </View>
  );
}

/** Кнопки в шапке стоят на 26 от верха кадра (node 3427:12220). */
const CONTROLS_TOP = 26;
/** Поля ряда кнопок — 20 (там же), а не 16, как у остального листа. */
const CONTROLS_PADDING = 20;

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: colors.brand2.navy,
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glow: {
    position: "absolute",
    alignSelf: "center",
  },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: CONTROLS_PADDING,
  },
  pill: {
    position: "absolute",
    alignSelf: "center",
    width: oceanPageLayout.heroPillWidth,
    height: oceanPageLayout.heroPillHeight,
    borderRadius: oceanPageLayout.heroPillRadius,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.brand2.pillBorder,
    backgroundColor: colors.brand2.pillSurface,
  },
  pillLabel: {
    ...typography.brandEyebrow,
    color: colors.brand2.gold,
  },
  seafood: {
    position: "absolute",
    alignSelf: "center",
    width: oceanPageLayout.heroSeafoodWidth,
    height: oceanPageLayout.heroSeafoodHeight,
  },
  expedition: {
    position: "absolute",
    alignSelf: "center",
    width: oceanPageLayout.heroExpeditionWidth,
    height: oceanPageLayout.heroExpeditionHeight,
  },
  welcome: {
    position: "absolute",
    // В макете плашка 342 при кадре 390 — то есть по 24 с каждой стороны.
    // Считаем от краёв, а не от ширины: экран бывает и 360, и 430.
    left: 24,
    right: 24,
    height: oceanPageLayout.welcomeHeight,
    borderRadius: oceanPageLayout.welcomeRadius,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 9,
    paddingRight: 14,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand2.accentBorder,
    backgroundColor: colors.brand2.welcomeSurface,
  },
  welcomeIcon: {
    width: oceanPageLayout.welcomeIconCircle,
    height: oceanPageLayout.welcomeIconCircle,
    borderRadius: oceanPageLayout.welcomeIconCircle / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand2.gold,
  },
  welcomeLabel: {
    ...typography.brandPromoLabel,
    color: colors.brand2.gold,
    // Надпись занимает всё, что осталось справа от значка: у казахской и
    // английской строки длина своя, а плашка тянется от края до края.
    flexShrink: 1,
    flexGrow: 1,
  },
});
