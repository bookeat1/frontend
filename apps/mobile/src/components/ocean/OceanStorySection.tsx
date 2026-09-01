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
 * «ИСТОРИЯ БРЕНДА» — макет 3z0f6dgev4HMwBAHPjTjPo, узлы 3443:12461…3443:12514:
 * разряженная надпись, двухцветный подзаголовок и четыре главы белыми
 * карточками. Первая раскрыта: её текст лежит на фотографии, затемнённой
 * градиентом.
 *
 * ТЕКСТ ЕСТЬ ТОЛЬКО У ПЕРВОЙ ГЛАВЫ. В макете раскрыта одна карточка, у трёх
 * остальных написаны лишь подпись и заголовок — самого текста дизайнер не
 * писал. Поэтому глава без текста рисуется СТРОКОЙ БЕЗ СТРЕЛКИ, а не кнопкой:
 * стрелка, открывающая пустоту, — обещание, которого страница не выполняет.
 * Появится текст в словаре — глава сама станет раскрывающейся.
 *
 * ЗНАЧКИ ГЛАВ — из набора Phosphor (якорь, рыба, спираль-ракушка, бокал), как
 * и все значки приложения. В макете это собственные рисунки дизайнера
 * («icon/chapter-1…4»); их векторный экспорт не открылся из-за лимита Figma,
 * поэтому взяты ближайшие глифы того же набора. Расхождение вынесено в отчёт.
 */
export function OceanStorySection() {
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
            // В макете раскрыта первая глава — такой страница и открывается.
            initiallyExpanded={index === 0}
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
  initiallyExpanded,
}: {
  index: number;
  label: string;
  title: string;
  /** Пустая строка — главы без текста, см. разбор у секции. */
  body: string;
  photo?: number;
  initiallyExpanded: boolean;
}) {
  const expandable = body.trim().length > 0;
  const [expanded, setExpanded] = useState(expandable && initiallyExpanded);
  const Icon = CHAPTER_ICONS[index] ?? Anchor;

  const head = (
    <View style={[styles.head, !expandable && styles.headCollapsedOnly]}>
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
      {expandable ? (
        expanded ? (
          <CaretUp size={12} color={colors.brand2.goldChevron} weight="bold" />
        ) : (
          <CaretDown size={12} color={colors.brand2.goldChevron} weight="bold" />
        )
      ) : null}
    </View>
  );

  return (
    <View style={styles.card}>
      {expandable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded ? t.oceanBasket.chapterCollapse(title) : t.oceanBasket.chapterExpand(title)
          }
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => (pressed ? styles.pressed : undefined)}
        >
          {head}
        </Pressable>
      ) : (
        head
      )}

      {expandable && expanded ? (
        <View style={styles.body}>
          {photo ? (
            <Image source={photo} style={styles.bodyPhoto} contentFit="cover" />
          ) : null}
          {/* Затемнение из макета (node 3443:12597): от прозрачного белого
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
  headCollapsedOnly: {
    // Свёрнутая глава в макете чуть выше — поля 18 сверху и снизу
    // (node 3443:12480) против 16 у раскрытой.
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
