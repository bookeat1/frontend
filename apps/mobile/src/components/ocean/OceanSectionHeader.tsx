import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * Заголовок секции фирменной страницы — макет 3z0f6dgev4HMwBAHPjTjPo, узлы
 * 3427:12238 («Все точки» + «3 ресторана») и 3441:12379 («Фирменный улов» +
 * «хиты меню»): крупный засечный заголовок слева и мелкая подпись справа.
 *
 * Один компонент на обе секции: в макете это одна и та же связка, и вторая её
 * копия разъехалась бы с первой на первой же правке кегля.
 */
export function OceanSectionHeader({
  title,
  note,
  /**
   * Кегль подписи справа. В макете он РАЗНЫЙ у двух секций: у счётчика точек
   * 14/17 (node 3427:12240), у «хитов меню» 12/14.6 (node 3441:12381). Это
   * проп, а не второй компонент.
   */
  noteSize = "body",
}: {
  title: string;
  note?: string;
  noteSize?: "body" | "caption";
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {note ? (
        <Text
          style={[styles.note, noteSize === "caption" ? styles.noteCaption : styles.noteBody]}
          numberOfLines={1}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  title: {
    ...typography.brandSectionTitle,
    color: colors.brand2.navy,
    // Заголовок уступает подписи, а не наоборот: подпись короткая и
    // фиксированная, заголовок переводится и бывает длиннее нарисованного.
    flexShrink: 1,
  },
  note: {
    color: colors.brand2.navy,
    textAlign: "right",
  },
  noteBody: {
    ...typography.brandBody,
  },
  noteCaption: {
    ...typography.brandCaptionTight,
  },
});
