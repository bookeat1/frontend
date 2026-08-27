import { brandPageLayout, colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Замыкающий блок страницы подборки — макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 3443:12583: тёмно-синий прямоугольник 150 со скруглением 22, золотая
 * надпись-рубрика, крупный заголовок Cormorant Garamond и золотая кнопка.
 *
 * В МАКЕТЕ КНОПКА ЗОВЁТ «Выберите точку на карте» — карты на этом экране нет
 * (см. `app/articles/[slug].tsx`: ручка подборки не отдаёт ни координат, ни
 * картинки карты), поэтому кнопка ведёт в каталог заведений. Это единственное
 * место, куда из подборки можно уйти дальше, не выдумывая связи: подставлять
 * сюда «первое заведение подборки» значило бы решать за гостя.
 */
export function BrandCta({
  eyebrow,
  title,
  actionLabel,
  onPress,
}: {
  eyebrow: string;
  title: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.eyebrow} numberOfLines={1}>
        {eyebrow}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    // Высота в макете фиксированная (150), но текст здесь переводится: у
    // казахского и английского заголовок длиннее и в 150 не всегда влезает.
    // Поэтому 150 — это МИНИМУМ, а не потолок: обрезать заголовок ради числа
    // из макета нельзя.
    minHeight: brandPageLayout.ctaHeight,
    borderRadius: radius.brandBlock,
    backgroundColor: colors.brand2.navyDeep,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: brandPageLayout.contentPaddingHorizontal,
  },
  eyebrow: {
    ...typography.brandVenueCity,
    color: colors.brand2.gold,
    textAlign: "center",
  },
  title: {
    ...typography.brandTitleLg,
    color: colors.brand2.onNavy,
    textAlign: "center",
  },
  button: {
    borderRadius: radius.brandBlock,
    backgroundColor: colors.brand2.gold,
    paddingHorizontal: brandPageLayout.ctaButtonPaddingHorizontal,
    paddingVertical: brandPageLayout.ctaButtonPaddingVertical,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    ...typography.brandButtonLabel,
    color: colors.brand2.navy,
    textAlign: "center",
  },
});
