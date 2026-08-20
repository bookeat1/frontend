import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlowHeader } from "../FlowHeader";

/**
 * Шапка экрана гастрогида (макет dVjT37j984ErvOmzxlx29p, node 1099:6802):
 * фотография города во всю ширину со скруглённым низом, затемнение поверх неё,
 * шапка на 56 pt с названием раздела и крупный слоган внизу кадра.
 *
 * Фотография БУНДЛИТСЯ с приложением (`assets/gastroguide-hero.jpg` — кадр из
 * самого макета), а не приходит с бэкенда: ручки «картинка шапки гастрогида» в
 * API нет, и подставлять сюда обложку первой подборки нельзя — она тут же
 * повторилась бы карточкой ниже. Тот же приём, что у шапки главной
 * (`assets/home-header.jpg`). Тёмная заливка под фотографией — цвет, который
 * гость видит, пока кадр декодируется, а не «второй плейсхолдер».
 *
 * Стрелка «назад» рисуется только когда есть куда возвращаться: `/articles`
 * теперь корень вкладки, и на корне вкладки стрелка вела бы в никуда или,
 * хуже, на чужую вкладку. Экран передаёт `onBack` только при
 * `router.canGoBack()`.
 */

/** Высота шапки НИЖЕ строки состояния: в макете кадр 300 при статус-баре 44
 * (56 шапка + 60 воздух + 140 блок слогана). Верхняя безопасная зона у разных
 * телефонов своя, поэтому она прибавляется, а не зашивается. */
export const GUIDE_HERO_CONTENT_HEIGHT = 256;

/** Блок слогана внизу кадра (node 1099:6822): 140 высотой, поля 16. */
const HEADLINE_BLOCK_HEIGHT = 140;

export function GuideHero({
  title,
  headline,
  onBack,
}: {
  /** Название раздела в шапке на 56 pt («Гастрогид»). */
  title: string;
  /** Крупный слоган поверх фотографии. */
  headline: string;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { height: insets.top + GUIDE_HERO_CONTENT_HEIGHT }]}>
      {/* Фотография и затемнение — декоративные слои ПОД управлением: прятать
          их надо поштучно, иначе из дерева доступности исчезнет и стрелка. */}
      <Image
        source={require("../../../assets/gastroguide-hero.jpg")}
        style={styles.photo}
        contentFit="cover"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={styles.scrim}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <View style={{ paddingTop: insets.top }}>
        <FlowHeader title={title} onBack={onBack} tone="onDark" />
      </View>

      <View style={styles.headlineBlock}>
        {/* Слоган в макете стоит в две строки. Ограничения строк тут нет
            намеренно: по-казахски и по-английски он длиннее, и обрезанный
            слоган хуже, чем слоган на три строки. */}
        <Text style={styles.headline}>{headline}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: "space-between",
    overflow: "hidden",
    borderBottomLeftRadius: radius.contentBlock,
    borderBottomRightRadius: radius.contentBlock,
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
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay.guideHeroScrim,
  },
  headlineBlock: {
    height: HEADLINE_BLOCK_HEIGHT,
    justifyContent: "center",
    padding: spacing.lg,
  },
  headline: {
    ...typography.titleXxl,
    color: colors.text.onDark,
  },
});
