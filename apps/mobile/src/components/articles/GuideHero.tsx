import { colors, guideLayout, radius, typography } from "@bookeat/design-tokens";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlowHeader } from "../FlowHeader";

/**
 * Шапка экрана гастрогида — макет «Editorial v2» (Figma
 * 3z0f6dgev4HMwBAHPjTjPo, node 3192:6247): фотография города во всю ширину со
 * скруглённым низом на 28, шапка на 56 pt с брендовой надписью по центру и
 * блок из трёх строк, прижатый к нижней кромке кадра.
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ ПРЕЖНЕЙ ШАПКИ (старый файл dVjT37j984ErvOmzxlx29p,
 * node 1099:6802):
 *   • кадр вырос с 256 до 296 ниже безопасной зоны (340 − 44 в макете);
 *   • скругление низа 28 вместо 24 (`radius.guideHero`);
 *   • затемнение теперь ДВУСЛОЙНОЕ: сплошные 20 % по всему кадру плюс
 *     градиент снизу (74 % у кромки → прозрачно к 65 % высоты). Прежний
 *     сплошной `overlay.guideHeroScrim` (30 %) гасил фотографию целиком, а
 *     новый макет держит верх кадра светлым;
 *   • слоган набран Playfair Display Italic 36, над ним появилась золотая
 *     надпись-рубрика, под ним — строка в 15/20.
 *
 * СТРЕЛКИ «НАЗАД» ТУТ ПО-ПРЕЖНЕМУ НЕТ, хотя в макете она нарисована
 * (node 3202:6432). `/articles` — корень вкладки, и из корня возвращаться
 * некуда: стрелка либо вела в никуда, либо уводила на другую вкладку — этот
 * баг из приложения уже убирали. `FlowHeader` без `onBack` оставляет слева
 * пустой слот той же ширины, поэтому заголовок остаётся по центру.
 *
 * Фотография БУНДЛИТСЯ с приложением (`assets/gastroguide-hero.jpg`), а не
 * приходит с бэкенда: ручки «картинка шапки гастрогида» в API нет.
 */

/** Высота шапки НИЖЕ строки состояния. Верхняя безопасная зона у разных
 * телефонов своя, поэтому она прибавляется, а не зашивается. */
export const GUIDE_HERO_CONTENT_HEIGHT = guideLayout.heroContentHeight;

export function GuideHero({
  title,
  eyebrow,
  headline,
  subline,
}: {
  /** Брендовая надпись в шапке на 56 pt (node 3192:6251). */
  title: string;
  /** Золотая строка над слоганом (node 3192:6254). */
  eyebrow: string;
  /** Крупный слоган поверх фотографии (node 3192:6255). */
  headline: string;
  /** Строка под слоганом (node 3192:6256). */
  subline: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { height: insets.top + GUIDE_HERO_CONTENT_HEIGHT }]}>
      {/* Фотография и оба затемнения — декоративные слои ПОД заголовком:
          прятать их от скринридера надо поштучно, иначе из дерева доступности
          исчезнет и сам заголовок раздела. */}
      <Image
        source={require("../../../assets/gastroguide-hero.jpg")}
        style={styles.photo}
        contentFit="cover"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={styles.flatScrim}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <LinearGradient
        // Градиент в макете идёт СНИЗУ ВВЕРХ (0deg): плотное затемнение у
        // нижней кромки, где лежит слоган, и прозрачность к 65 % высоты.
        // `LinearGradient` рисует сверху вниз, поэтому порядок цветов
        // перевёрнут, а точка 65 % снизу — это 35 % сверху.
        colors={[colors.guide.heroGradientTop, colors.guide.heroGradientBottom]}
        locations={[0.35, 1]}
        style={styles.gradientScrim}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <View style={{ paddingTop: insets.top }}>
        <FlowHeader title={title} tone="onDark" />
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {/* Ограничения строк нет намеренно: по-казахски и по-английски слоган
            длиннее, и обрезанный слоган хуже слогана на три строки. */}
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subline}>{subline}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: "space-between",
    overflow: "hidden",
    borderBottomLeftRadius: radius.guideHero,
    borderBottomRightRadius: radius.guideHero,
    // Цвет под фотографией, пока она декодируется: белый мигал бы, а белая
    // надпись на нём была бы нечитаемой.
    backgroundColor: colors.background.header,
  },
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flatScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.guide.heroFlatScrim,
  },
  gradientScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  copy: {
    paddingHorizontal: guideLayout.contentPaddingHorizontal,
    paddingBottom: guideLayout.heroCopyBottom,
    gap: guideLayout.heroCopyGap,
  },
  eyebrow: {
    ...typography.guideHeroEyebrow,
    color: colors.guide.gold,
  },
  headline: {
    ...typography.guideHeroHeadline,
    color: colors.text.onDark,
  },
  subline: {
    ...typography.guideHeroSubline,
    color: colors.text.onDark,
  },
});
