import { colors, oceanPageLayout, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { OceanSectionHeader } from "./OceanSectionHeader";
import { oceanDishPhotos } from "./ocean-basket-content";

const t = getDictionary();

/**
 * «ФИРМЕННЫЙ УЛОВ» — макет 3z0f6dgev4HMwBAHPjTjPo, узлы 3441:12377…3441:12393:
 * заголовок с подписью «хиты меню» и ряд карточек блюда (фотография 108,
 * название, цена).
 *
 * БЛЮДА ЗАШИТЫ В КОД вместе с ценами — решение владельца 2026-09-01. Это
 * значит ровно то, что написано: карточка не связана с меню заведения, id
 * блюда у неё нет, и цена не обновится сама. Когда в Ocean Basket поменяется
 * прайс, эти две строки придётся править разработчику.
 *
 * КАРТОЧКА НЕ НАЖИМАЕТСЯ, и строки «Тапните блюдо — оформим предзаказ к столу»
 * (node 3441:12382) здесь НЕТ. Предзаказ в приложении начинается с брони
 * конкретного заведения и требует настоящий `menu_item_id`; у зашитого блюда
 * его нет. Нарисованная строка обещала бы гостю оформление заказа, которого не
 * произойдёт, — это ровно тот случай, когда макет повторять нельзя. Как только
 * блок начнёт приходить из API с идентификаторами блюд, строка и переход
 * возвращаются вместе.
 */
export function OceanDishesSection({ contentPadding }: { contentPadding: number }) {
  return (
    <View style={styles.section}>
      <OceanSectionHeader
        title={t.oceanBasket.dishesTitle}
        note={t.oceanBasket.dishesNote}
        noteSize="caption"
      />
      {/* Ряд шире листа (в макете 364 при 358 свободных), поэтому он
          прокручивается: вторая карточка выглядывает краем и видно, что ряд
          продолжается. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Ряд выходит за поля листа и возвращает их себе внутренним отступом:
        // иначе карточка обрывалась бы по краю текста, а не по краю экрана.
        style={{ marginHorizontal: -contentPadding }}
        contentContainerStyle={[styles.rail, { paddingHorizontal: contentPadding }]}
      >
        {t.oceanBasket.dishes.map((dish, index) => (
          <View key={dish.name} style={styles.card}>
            <Image
              source={oceanDishPhotos[index]}
              style={styles.photo}
              contentFit="cover"
              accessibilityLabel={dish.name}
            />
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={2}>
                {dish.name}
              </Text>
              <Text style={styles.price} numberOfLines={1}>
                {dish.price}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  rail: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: oceanPageLayout.dishCardGap,
  },
  card: {
    width: oceanPageLayout.dishCardWidth,
    borderRadius: oceanPageLayout.dishCardRadius,
    backgroundColor: colors.background.surface,
    overflow: "hidden",
  },
  photo: {
    width: "100%",
    height: oceanPageLayout.dishPhotoHeight,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  name: {
    ...typography.brandDishName,
    color: colors.brand2.navy,
  },
  price: {
    ...typography.brandDishPrice,
    color: colors.brand2.navy,
  },
});
