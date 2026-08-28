import { colors, guideLayout, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * Заголовок секции гастрогида «Editorial v2» (Figma 3z0f6dgev4HMwBAHPjTjPo,
 * узлы 3192:6259, 3192:6264, 3192:6272, текст 3492:13477 / 3492:13479 /
 * 3492:13486): строка 28 pt, слева название Bold 20/28, справа — ничего.
 *
 * БЫЛО Playfair Display Italic 24 в строке 32 pt. Макет перерисован:
 * заголовки секций заменены новыми текстовыми узлами без засечек.
 *
 * ЭТО ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ `SectionHeader` С ПРОПОМ. Общий
 * `explore/SectionCard#SectionHeader` рисует Noto Sans 17/24 с шевроном —
 * другой кегль и шеврон-ссылка справа. Здесь 20/28 и ссылки нет; добавить
 * туда проп значило бы завести на одном компоненте два разных заголовка
 * (ровно та ошибка, из-за которой у `SectionHeader` уже отбирали проп
 * `size`).
 *
 * «СМОТРЕТЬ ВСЕ» В МАКЕТЕ ЕСТЬ (узлы 3192:6261 и 3192:6274), А ЗДЕСЬ ЕГО НЕТ.
 * Вести эту ссылку некуда: экран гастрогида И ЕСТЬ полный список подборок
 * (`GET /gastroguide/collections` отдаёт их все, без страниц), а экрана
 * «все рубрики» или «все гастропрогулки» в приложении не существует.
 * Нарисовать надпись значило бы завести контрол, который ничего не делает, —
 * такое из этого приложения уже убирали. Появится экран — надпись вернётся
 * сюда вместе с `onSeeAll`.
 */
export function GuideSectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: guideLayout.sectionHeaderHeight,
  },
  title: {
    ...typography.guideSectionTitle,
    color: colors.guide.headline,
    flexShrink: 1,
  },
});
