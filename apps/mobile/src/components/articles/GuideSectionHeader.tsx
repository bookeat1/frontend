import { colors, guideLayout, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * Заголовок секции гастрогида «Editorial v2» (Figma 3z0f6dgev4HMwBAHPjTjPo,
 * узлы 3192:6259, 3192:6264, 3192:6272): строка 32 pt, слева название
 * Playfair Display Italic 24, справа — ничего.
 *
 * ЭТО ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ `SectionHeader` С ПРОПОМ. Общий
 * `explore/SectionCard#SectionHeader` рисует Noto Sans 17/24 с шевроном —
 * это язык главной и поиска. Гастрогид в новом макете набран журнально, и
 * добавить сюда проп значило бы завести на одном компоненте два разных
 * визуальных языка (ровно та ошибка, из-за которой у `SectionHeader` уже
 * отбирали проп `size`).
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
