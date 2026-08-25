import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * A calm row of grey label chips — the event «Афиша» tags ("Бранч", "Живая
 * музыка"). Plain text, no icon. Wraps to multiple lines when there are many.
 *
 * Renders nothing when `tags` is empty, so a caller can drop it straight under
 * the «venue · date» line without its own guard.
 *
 * ГАММА (правка владельца 2026-08-20, макет 3053:8539): чип-метка внутри
 * карточки стал бордовым — подложка `background.chipBrand` (фирменный цвет с
 * прозрачностью 15%), подпись `text.brand` (#96272C). Тот же вид у кухни и
 * среднего чека на карточке заведения, поэтому все метки в списках читаются
 * одинаково.
 *
 * Чипы-ФИЛЬТРЫ (`FilterChip`) остались серыми и в этой правке не участвуют:
 * фильтр это переключатель, метка это подпись, и одинаковый вид у них сбивал
 * бы с толку.
 */
export function TagChips({
  tags,
  size = "default",
  flush = false,
}: {
  tags: string[];
  /**
   * `compact` — 24 в высоту с зазором 6 между чипами (карточка события на
   * экране «Избранное», макет 602:3630). Это ОДИН размер того же чипа, а не
   * второй компонент: у карточки списка избранного меньше места, чем у карточки
   * афиши, и чип там ровно такой же, как кухня/чек у карточки заведения.
   */
  size?: "default" | "compact";
  /**
   * Убирает собственный отступ ряда сверху. Нужен там, где расстояние над
   * метками задаёт колонка вокруг (строка «Афиши» на главной, макет
   * 3228:9828 — зазор 8 у самой колонки): иначе к нему прибавлялись бы ещё 2
   * и метки уезжали ниже макета.
   */
  flush?: boolean;
}) {
  if (tags.length === 0) return null;

  const compact = size === "compact";
  return (
    <View style={[styles.row, compact && styles.rowCompact, flush && styles.rowFlush]}>
      {tags.map((tag, index) => (
        <View key={`${tag}-${index}`} style={[styles.chip, compact && styles.chipCompact]}>
          {/* Подпись метки всегда в одну строку: перенос делает чип вдвое выше
              и ломает высоту карточки вокруг. Длинная метка обрезается. */}
          <Text
            style={[styles.chipText, compact && styles.chipTextCompact]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  chip: {
    backgroundColor: colors.background.chipBrand,
    borderRadius: radius.pill,
    // В макете карточки афиши чип — полноценная метка, а не мелкая подпись:
    // 12 по горизонтали и 6 по вертикали вместо 8/2.
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  // Зазор 6 — из макета; в шкале spacing такого шага нет (4 и 8), поэтому он
  // собран из существующего токена, а не написан числом.
  rowCompact: {
    gap: spacing.xs + 2,
  },
  rowFlush: {
    marginTop: 0,
  },
  chipCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: {
    // 12/16 Medium из макета (node 3053:8540), а не 14: чип-метка мельче
    // подписи фильтра.
    ...typography.captionMedium,
    color: colors.text.brand,
  },
  // Компактный размер отличается только полями, подпись та же 12/16.
  chipTextCompact: {
    ...typography.captionMedium,
  },
});
