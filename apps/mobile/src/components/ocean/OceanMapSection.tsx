import { colors, oceanPageLayout, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { oceanAssets } from "./ocean-basket-content";

const t = getDictionary();

/**
 * «Найдите свой улов» — макет 3z0f6dgev4HMwBAHPjTjPo, узлы 3426:9632 и
 * 3426:9633: заголовок и карточка карты 240 высотой со скруглением 22.
 *
 * КАРТА НАРИСОВАННАЯ, А НЕ ЖИВАЯ, и это не упрощение, а единственный честный
 * вариант на сегодня. Живой её сделать нечем: прокси статических карт на проде
 * выключен (`STATIC_MAP_PROVIDER` не задан, ручка отвечает 503
 * `map_not_configured`), а координаты заполнены у меньшинства заведений
 * каталога. В макете здесь и нарисована иллюстрация — фирменная карта с
 * рукописными подписями, а не снимок настоящей местности; мы выгрузили её из
 * макета как картинку.
 *
 * Иллюстрация НЕ НАЖИМАЕТСЯ: карта, которая не открывается, обещает больше,
 * чем есть. Точки открываются с карточек ниже.
 */
export function OceanMapSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t.oceanBasket.mapTitle}</Text>
      <Image
        source={oceanAssets.map}
        style={styles.map}
        contentFit="cover"
        accessibilityLabel={t.oceanBasket.mapAlt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  title: {
    ...typography.brandSectionTitle,
    color: colors.brand2.navy,
  },
  map: {
    width: "100%",
    height: oceanPageLayout.mapHeight,
    borderRadius: oceanPageLayout.mapRadius,
    borderWidth: 1,
    borderColor: colors.brand2.mapBorder,
    // Тень из макета (node 3426:9633): 12 % чёрно-синего, радиус 18, сдвиг
    // вниз на 14. На Android тень даёт `elevation`, размытие там своё.
    shadowColor: colors.brand2.mapShadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
});
