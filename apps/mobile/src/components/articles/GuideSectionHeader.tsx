import { colors, guideLayout, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const t = getDictionary();

/**
 * Заголовок секции гастрогида «Editorial v2» (Figma 3z0f6dgev4HMwBAHPjTjPo,
 * узлы 3192:6259, 3192:6264, 3192:6272, текст 3492:13477 / 3492:13479 /
 * 3492:13486): строка 28 pt, слева название Bold 20/28, справа — ссылка
 * «Смотреть все» (node 3192:6261, SemiBold 13, цвет #B23036).
 *
 * БЫЛО Playfair Display Italic 24 в строке 32 pt. Макет перерисован:
 * заголовки секций заменены новыми текстовыми узлами без засечек.
 *
 * ЭТО ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ `SectionHeader` С ПРОПОМ. Общий
 * `explore/SectionCard#SectionHeader` рисует Noto Sans 17/24 с шевроном —
 * другой кегль и шеврон-ссылка справа. Здесь 20/28 и надпись; добавить
 * туда проп значило бы завести на одном компоненте два разных заголовка
 * (ровно та ошибка, из-за которой у `SectionHeader` уже отбирали проп
 * `size`).
 *
 * «СМОТРЕТЬ ВСЕ» РИСУЕТСЯ ТОЛЬКО ТАМ, КУДА ЕСТЬ КУДА ВЕСТИ. Надпись есть в
 * макете у всех трёх секций, но контрол, который ничего не делает, из этого
 * приложения уже убирали, поэтому она приходит пропом `onSeeAll`:
 *
 *   • «Рубрики» — с 2026-08-28 ведёт на экран всех рубрик
 *     (`/gastroguide/rubrics`, правка владельца «лучше столбиком»);
 *   • «Выбор редакции» — вести некуда: экран гастрогида И ЕСТЬ полный список
 *     подборок (`GET /gastroguide/collections` отдаёт их все, без страниц);
 *   • «Гастропрогулки» — то же самое, экрана «все гастропрогулки» нет.
 */
export function GuideSectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  /** Есть куда вести — появляется надпись «Смотреть все». Нет — её нет. */
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
        {title}
      </Text>
      {onSeeAll ? (
        <Pressable
          accessibilityRole="button"
          // Подпись для чтения с экрана называет СЕКЦИЮ: «Смотреть все» в
          // отрыве от заголовка не говорит, что именно откроется.
          accessibilityLabel={t.explore.sectionSeeAll(title)}
          onPress={onSeeAll}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.link}>{t.common.seeAll}</Text>
        </Pressable>
      ) : null}
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
  link: {
    ...typography.guideSectionLink,
    color: colors.guide.link,
  },
  pressed: {
    opacity: 0.6,
  },
});
