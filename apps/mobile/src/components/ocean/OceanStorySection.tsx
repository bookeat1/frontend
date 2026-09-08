import { colors, oceanPageLayout, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Anchor, CaretDown, CaretUp, Fish, Spiral, Wine, type IconProps } from "../icons";
import { oceanChapterPhotos, spacedOut } from "./ocean-basket-content";

const t = getDictionary();

/**
 * «ИСТОРИЯ БРЕНДА» — макет 3z0f6dgev4HMwBAHPjTjPo, узлы 5012:5585…5012:5630
 * (спека `spec-chapters-accordion.md`): разряженная надпись, двухцветный
 * подзаголовок и четыре главы белыми карточками. Раскрытая глава — шапка 76
 * плюс тело 173 с фотографией под градиентом; свёрнутая — один ряд 82.
 *
 * ГАРМОШКА: открыта НЕ БОЛЬШЕ ОДНОЙ главы (решение владельца 2026-09-03).
 * Открываешь новую — предыдущая закрывается сама; тап по открытой сворачивает
 * её. Состояние поэтому живёт у секции (`expandedIndex`), а не у карточки:
 * карточка, которая знает только про себя, не может закрыть соседку.
 * Страница открывается с раскрытой первой главой — так нарисовано.
 *
 * ШЕВРОН У ОТКРЫТОЙ ГЛАВЫ СМОТРИТ ВВЕРХ — осознанное отступление от макета:
 * там во всех четырёх карточках стоит один и тот же `icon/chevron-down`, и
 * у раскрытой тоже (проверено по сырому JSON, поля `rotation` нет). Стрелка
 * вниз над открытым телом обещает, что там есть ещё, — это ошибка макета, а
 * не задумка.
 *
 * ЗНАЧКИ ГЛАВ — из набора Phosphor (якорь, рыба, спираль-ракушка, бокал), как
 * и все значки приложения. В макете это собственные рисунки дизайнера
 * («icon/chapter-1…4»); взяты ближайшие глифы того же набора.
 */
export function OceanStorySection() {
  // В макете раскрыта первая глава — такой страница и открывается.
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text
          style={styles.eyebrow}
          // Разрядку в макете делают пробелы внутри строки; скринридеру
          // отдаётся нормальная строка, иначе он читает её по буквам.
          accessibilityLabel={t.oceanBasket.storyEyebrow}
        >
          {`—  ${spacedOut(t.oceanBasket.storyEyebrow)}  —`}
        </Text>
        <View style={styles.titleRow}>
          <Text style={styles.titleLead}>{t.oceanBasket.storyTitleLead}</Text>
          <Text style={styles.titleTail}>{t.oceanBasket.storyTitleTail}</Text>
        </View>
      </View>

      <View style={styles.chapters}>
        {t.oceanBasket.chapters.map((chapter, index) => (
          <OceanStoryChapter
            key={chapter.label}
            index={index}
            label={chapter.label}
            title={chapter.title}
            body={chapter.body}
            photo={oceanChapterPhotos[index]}
            expanded={expandedIndex === index}
            onToggle={() => setExpandedIndex((current) => (current === index ? null : index))}
          />
        ))}
      </View>
    </View>
  );
}

/** Значки глав по порядку макета (узлы 3443:12472, 3443:12484, 3443:12497,
 * 3443:12508): якорь, рыба, ракушка-спираль, бокал. */
const CHAPTER_ICONS: readonly React.ComponentType<IconProps>[] = [Anchor, Fish, Spiral, Wine];

function OceanStoryChapter({
  index,
  label,
  title,
  body,
  photo,
  expanded,
  onToggle,
}: {
  index: number;
  label: string;
  title: string;
  body: string;
  photo?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = CHAPTER_ICONS[index] ?? Anchor;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded ? t.oceanBasket.chapterCollapse(title) : t.oceanBasket.chapterExpand(title)
        }
        onPress={onToggle}
        style={({ pressed }) => [
          styles.head,
          // Свёрнутая глава в макете чуть выше — поля 18 сверху и снизу
          // (node 5012:5606) против 16 у раскрытой (node 5011:5121).
          !expanded && styles.headCollapsed,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.headText}>
          <View style={styles.iconCircle}>
            <Icon size={20} color={colors.brand2.goldIcon} weight="regular" />
          </View>
          <View style={styles.headLabels}>
            <Text style={styles.chapterLabel} numberOfLines={2}>
              {label}
            </Text>
            <Text style={styles.chapterTitle} numberOfLines={2}>
              {title}
            </Text>
          </View>
        </View>
        {expanded ? (
          <CaretUp size={12} color={colors.brand2.goldChevron} weight="bold" />
        ) : (
          <CaretDown size={12} color={colors.brand2.goldChevron} weight="bold" />
        )}
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {photo ? <Image source={photo} style={styles.bodyPhoto} contentFit="cover" /> : null}
          {/* Затемнение из макета (node 5011:5133): от прозрачного белого
              через синий 45 % к сплошному синему — иначе светлый текст на
              светлой фотографии нечитаем. */}
          <LinearGradient
            colors={[colors.background.surfaceTransparent, colors.brand2.storyScrim, colors.brand2.navy]}
            locations={[0, 0.51, 1]}
            style={styles.bodyScrim}
            pointerEvents="none"
          />
          <Text style={styles.bodyText}>{body}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  header: {
    alignItems: "center",
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.brandStoryHeading,
    color: colors.brand2.goldMuted,
    textAlign: "center",
  },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  titleLead: {
    ...typography.brandTitleSm,
    color: colors.brand2.navy,
  },
  titleTail: {
    ...typography.brandTitleSm,
    color: colors.brand2.goldMuted,
  },
  chapters: {
    gap: oceanPageLayout.storyGap,
  },
  card: {
    borderRadius: oceanPageLayout.storyCardRadius,
    borderWidth: 1,
    borderColor: colors.brand2.cardBorder,
    backgroundColor: colors.background.surface,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.8,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: oceanPageLayout.storyHeaderPadding,
  },
  headCollapsed: {
    paddingVertical: oceanPageLayout.storyCollapsedPaddingVertical,
  },
  headText: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexShrink: 1,
    flexGrow: 1,
  },
  iconCircle: {
    width: oceanPageLayout.storyIconCircle,
    height: oceanPageLayout.storyIconCircle,
    borderRadius: oceanPageLayout.storyIconCircle / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.brand2.goldRing,
  },
  headLabels: {
    gap: 2,
    flexShrink: 1,
  },
  chapterLabel: {
    ...typography.brandChapterLabel,
    color: colors.brand2.goldMuted,
  },
  chapterTitle: {
    ...typography.brandTitleSm,
    color: colors.brand2.navy,
  },
  body: {
    // 173 в макете — МИНИМУМ: тело зафиксировано на 173 при тексте в 3–4
    // строки, а казахский и английский бывают длиннее.
    minHeight: oceanPageLayout.storyBodyHeight,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.brand2.navy,
  },
  bodyPhoto: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bodyScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bodyText: {
    ...typography.brandStoryBody,
    color: colors.brand2.storyBody,
  },
});
