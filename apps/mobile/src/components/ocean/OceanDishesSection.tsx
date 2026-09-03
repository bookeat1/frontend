import { colors, oceanPageLayout, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { dishCardFromMenuDish, type DishCardItem } from "../../lib/dish-card";
import { formatMoneyMinor } from "../../lib/format";
import { DishDetailSheet } from "../restaurant/DishDetailSheet";
import { OCEAN_SIGNATURE_DISHES } from "./ocean-basket-content";
import { OceanSectionHeader } from "./OceanSectionHeader";
import type { OceanSignatureDishesState } from "./use-ocean-signature-dishes";

const t = getDictionary();

/**
 * «ФИРМЕННЫЙ УЛОВ» — макет 3z0f6dgev4HMwBAHPjTjPo, узлы 3441:12377…3441:12393:
 * заголовок с подписью «хиты меню» и ряд карточек блюда (фотография 108,
 * название, цена).
 *
 * С 2026-09-03 КАРТОЧКИ ЖИВЫЕ. Название и цена — из меню первой точки бренда
 * (`useOceanSignatureDishes`), а не из словаря: зашитая цена разъезжалась бы
 * с меню при первой же смене прайса. Из макета остались только фотографии и
 * имя, по которому блюдо ищется (`OCEAN_SIGNATURE_DISHES`).
 *
 * НАЖАТИЕ ОТКРЫВАЕТ КАРТОЧКУ БЛЮДА — ту же `DishDetailSheet`, что на экране
 * меню и в ленте «Популярное в меню». Без «Добавить»: предзаказ начинается с
 * брони конкретной точки, а страница общая для бренда. Строки «Тапните
 * блюдо — оформим предзаказ к столу» (node 3441:12382) по-прежнему НЕТ —
 * предзаказа отсюда нет.
 *
 * ЧЕТЫРЕ СОСТОЯНИЯ живут ВНУТРИ карточки, а не вместо ряда: фотография из
 * макета есть всегда, меняется только подпись под ней. Загрузка —
 * «Загружаем меню…», ошибка — «Меню не загрузилось» с повтором по нажатию,
 * блюдо не нашлось в меню — «Ищите в меню заведения» и карточка не кнопка.
 */
export function OceanDishesSection({
  contentPadding,
  state,
}: {
  contentPadding: number;
  state: OceanSignatureDishesState;
}) {
  const [openedDish, setOpenedDish] = useState<DishCardItem | null>(null);

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
        {OCEAN_SIGNATURE_DISHES.map((signature, index) => (
          <OceanDishCard
            key={signature.menuName}
            photo={signature.photo}
            state={state}
            index={index}
            onOpen={setOpenedDish}
          />
        ))}
      </ScrollView>

      {/* Карточка читательская: `canAdd={false}`, поэтому `onAdd` не зовётся
          никогда — предзаказ начинается с брони конкретной точки. */}
      <DishDetailSheet
        dish={openedDish}
        canAdd={false}
        onAdd={() => {}}
        onClose={() => setOpenedDish(null)}
      />
    </View>
  );
}

function OceanDishCard({
  photo,
  state,
  index,
  onOpen,
}: {
  photo: number;
  state: OceanSignatureDishesState;
  index: number;
  onOpen: (dish: DishCardItem) => void;
}) {
  const dish = state.status === "ready" ? state.dishes[index] : undefined;

  const picture = <Image source={photo} style={styles.photo} contentFit="cover" />;

  if (state.status === "loading") {
    return (
      <View style={styles.card} accessibilityState={{ busy: true }}>
        {picture}
        <View style={styles.body}>
          <Text style={styles.note}>{t.oceanBasket.dishesLoading}</Text>
        </View>
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.common.retry}
        onPress={state.retry}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {picture}
        <View style={styles.body}>
          <Text style={styles.note}>{t.oceanBasket.dishesError}</Text>
          <Text style={styles.retry}>{t.common.retry}</Text>
        </View>
      </Pressable>
    );
  }

  if (!dish) {
    // Блюда с таким именем в меню нет: карточка остаётся — с фотографией и
    // нейтральной подписью — но не кнопка: открывать ей нечего.
    return (
      <View style={styles.card}>
        {picture}
        <View style={styles.body}>
          <Text style={styles.note}>{t.oceanBasket.dishMissing}</Text>
        </View>
      </View>
    );
  }

  const price =
    dish.priceMinor === null ? t.restaurant.menuDishNoPrice : formatMoneyMinor(dish.priceMinor);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.oceanBasket.dishOpen(dish.name)}
      onPress={() => onOpen(dishCardFromMenuDish(dish))}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {picture}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {dish.name}
        </Text>
        <Text style={styles.price} numberOfLines={1}>
          {price}
        </Text>
      </View>
    </Pressable>
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
  pressed: {
    opacity: 0.8,
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
  /** Подпись состояния на месте названия — тем же кеглем, но приглушённо:
   * это не блюдо, а сообщение о нём. */
  note: {
    ...typography.brandDishName,
    color: colors.brand2.muted,
  },
  retry: {
    ...typography.brandDishPrice,
    color: colors.brand2.goldMuted,
  },
});
