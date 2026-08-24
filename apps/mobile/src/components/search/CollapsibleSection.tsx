import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CaretDown, CaretUp } from "../icons";

interface CollapsibleSectionProps {
  title: string;
  /** Right-side summary of the current selection, e.g. «Не выбрано» / «3
   * выбрано». Coloured brand-red once something is chosen (matches the PNG). */
  summary: string;
  /** Whether the summary should read as "has a selection" (brand-red) or empty
   * (muted). */
  hasSelection: boolean;
  expanded: boolean;
  onToggle: () => void;
  /**
   * Чипы выбранных значений, которые видно у СВЁРНУТОГО раздела вместо
   * красной подписи «1 выбрано»: гость читает, что именно выбрано, и снимает
   * лишнее, не разворачивая список. Пусто (`hasSelection === false`) — раздел
   * выглядит как раньше, «Не выбрано».
   *
   * Ряд прокручивается горизонтально: «Можно с питомцами» и «Намазхана»
   * рядом не влезают в 360 и иначе разорвали бы заголовок раздела.
   */
  selectionChips?: React.ReactNode;
  /** The chips / checkbox rows shown when the section is open. */
  children: React.ReactNode;
}

/**
 * A section whose header stays visible and whose body folds away — «Кухня» and
 * «Удобства» in the Filters sheet share this exact pattern: a left title, a
 * right summary of how many are picked, and a caret that flips up when open.
 * One primitive for both so the two rows can't drift apart.
 */
export function CollapsibleSection({
  title,
  summary,
  hasSelection,
  expanded,
  onToggle,
  selectionChips,
  children,
}: CollapsibleSectionProps) {
  const Caret = expanded ? CaretUp : CaretDown;
  const showChips = !expanded && hasSelection && selectionChips !== undefined;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}: ${summary}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Text style={styles.title}>{title}</Text>
        <View style={styles.right}>
          {showChips ? null : (
            <Text style={[styles.summary, hasSelection && styles.summaryActive]}>{summary}</Text>
          )}
          <Caret size={20} color={colors.text.primary} weight="regular" />
        </View>
      </Pressable>
      {/* Чипы под заголовком, а не в его правой части: с крестиком и длинным
          русским названием они отжали бы название раздела в перенос. Метка
          самого заголовка при этом по-прежнему называет счёт («Кухня: 1
          выбрано») — скринридер не теряет сводку. */}
      {showChips ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {selectionChips}
        </ScrollView>
      ) : null}
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: hitSlop.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    ...typography.titleSm,
    color: colors.text.primary,
    flexShrink: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  summary: {
    ...typography.labelMedium,
    color: colors.text.muted,
  },
  summaryActive: {
    color: colors.brand.primary,
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  body: {
    marginTop: spacing.md,
  },
});
