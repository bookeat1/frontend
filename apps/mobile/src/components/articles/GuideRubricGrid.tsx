import type { GuideCollection } from "@bookeat/api";
import { colors, guideLayout, radius, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * «Рубрики» гастрогида — СЕТКА в две колонки. Макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 3192:6246; сами ряды — 3566:7284 и 3566:7305, плитки 3566:7275,
 * 3566:7315, 3566:7320, 3566:7325.
 *
 * БЫЛО: горизонтальная лента плиток фиксированной ширины 118 (`GuideRubricRail`,
 * узлы 3192:6258 и 3192:6133 прежней редакции макета). Макет переписан —
 * рубрики выложены сеткой: два ряда по две плитки, колонки равной ширины
 * (`flex-[1_0_0]`), просвет 12 и по горизонтали, и по вертикали, высота
 * плитки прежняя — 158.
 *
 * ПОЧЕМУ ШИРИНА СЧИТАЕТСЯ, А НЕ ЗАДАНА ПРОЦЕНТОМ. В макете колонка — это
 * «половина оставшегося места», то есть `(343 − 12) / 2 = 165.5` на кадре 375.
 * Проценты этого не выражают: `48 %` дало бы на 360 просвет 14, а не 12, и
 * сетка ехала бы вслед за шириной экрана. Ширину листа знает окно, поля листа
 * — `guideLayout.contentPaddingHorizontal`, и `useWindowDimensions` пересчитает
 * её при повороте и в разделённом экране.
 *
 * СКОЛЬКО ПЛИТОК. В макете нарисованы четыре, но обрезать список до четырёх
 * значило бы молча спрятать рубрики: сетка прокручивается вместе с экраном, а
 * не вбок, и лишний ряд ей не мешает. Полный справочник рубрик (в том числе
 * пустые, которых в этой сетке нет) по-прежнему живёт за «Смотреть все».
 *
 * ЧЕМ КОРМИТСЯ. Той же подборкой, что и раньше: гостевая ручка рубрик
 * (`GET /gastroguide/categories`) отдаёт `{id, slug, title, position}` — ни
 * обложки, ни картинки, и плитка из неё выходила пустой плашкой. У подборки
 * есть `cover_image_url`, а её `categorySlugs` дают золотую надпись сверху.
 * Обложки нет — стандартная плашка «фото нет», выдуманной картинки тут не
 * будет.
 *
 * КУДА ВЕДЁТ ПЛИТКА. Она нарисована как РУБРИКА, поэтому и открывает экран
 * рубрики (`/gastroguide/rubric/:categorySlug`, node 3492:13723), а не
 * подборку, из которой её собрали. Наружу уходит вся подборка целиком:
 * решение, по какому слагу открывать, принимает экран, а не плитка.
 */
export function GuideRubricGrid({
  collections,
  onPress,
}: {
  collections: GuideCollection[];
  /** Наружу уходит вся подборка: слаг рубрики лежит в её `categorySlugs`, и
   * выбирать между ним и слагом подборки — дело экрана. */
  onPress: (collection: GuideCollection) => void;
}) {
  const { width } = useWindowDimensions();
  const columnWidth = rubricColumnWidth(width);

  if (collections.length === 0) return null;

  return (
    <View style={styles.grid}>
      {collections.map((collection) => {
        const summary = collection.subtitle || collection.description;
        return (
          <GuideRubricTile
            key={collection.slug}
            width={columnWidth}
            coverImageUrl={collection.coverImageUrl}
            eyebrow={rubricLabel(collection.categorySlugs)}
            title={collection.title}
            accessibilityLabel={
              summary ? t.articles.card(collection.title, summary) : collection.title
            }
            onPress={() => onPress(collection)}
          />
        );
      })}
    </View>
  );
}

/**
 * Ширина одной колонки сетки на экране шириной `screenWidth`.
 *
 * Вынесена наружу и покрыта тестом, потому что это единственное место, где
 * геометрия макета превращается в число: две равные колонки внутри листа с
 * полями 16 и просветом 12 между ними. Округление ВНИЗ — лишние полпикселя
 * должны оставаться в просвете, а не выдавливать вторую плитку на следующий
 * ряд.
 */
export function rubricColumnWidth(screenWidth: number): number {
  const content = screenWidth - guideLayout.contentPaddingHorizontal * 2;
  return Math.floor((content - guideLayout.rubricGap) / guideLayout.rubricColumns);
}

/**
 * Золотая надпись на плитке — рубрика подборки заглавными.
 *
 * Берётся ПЕРВЫЙ слаг из `categorySlugs`: в этой сетке только те подборки, у
 * которых он есть (см. `splitGuideCollections`), а название рубрики отдельной
 * ручкой ради одной строки не тянем — слаг редакция пишет читаемым
 * («kazakh-cuisine»), и дефисы разворачиваются в пробелы. Если слаг всё-таки
 * пуст, надписи просто нет: выдумывать рубрику нельзя.
 */
export function rubricLabel(categorySlugs: readonly string[]): string {
  const slug = categorySlugs[0]?.trim();
  if (!slug) return "";
  return slug.replace(/[-_]+/g, " ").toUpperCase();
}

/**
 * ПЛИТКА РУБРИКИ — высота 158, скругление 22, поле 12, надписи в нижнем левом
 * углу поверх затемнения (node 3566:7275 и соседи). Ширину задаёт сетка: в
 * макете колонка тянется, а не стоит на фиксированном числе.
 *
 * Экран «Все рубрики» (`/gastroguide/rubrics`) этой плиткой НЕ рисуется —
 * 2026-08-28 владелец попросил «сделать рубрики как листинг акций», и тот
 * экран живёт на общей `ListMediaCard`.
 */
export function GuideRubricTile({
  width,
  coverImageUrl,
  eyebrow,
  title,
  accessibilityLabel,
  onPress,
}: {
  /** Ширина колонки, посчитанная сеткой (`rubricColumnWidth`). */
  width: number;
  /** Обложки нет — стандартная плашка «фото нет», выдуманной картинки не будет. */
  coverImageUrl: string | null;
  /** Золотая надпись над названием. Пусто — надписи нет. */
  eyebrow?: string;
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <PhotoView
        uri={coverImageUrl}
        style={styles.photo}
        decorative
        size="tile"
        placeholderIconSize={32}
      />
      <LinearGradient
        colors={[colors.guide.scrimStart, colors.guide.rubricScrimEnd]}
        // Затемнение начинается ровно на середине кадра (49.5 % в макете) —
        // выше него фотография остаётся нетронутой.
        locations={[0.495, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />
      <View style={styles.copy}>
        {eyebrow ? (
          <Text style={styles.eyebrow} numberOfLines={1} ellipsizeMode="tail">
            {eyebrow}
          </Text>
        ) : null}
        {/* Две строки, как в макете: живые названия («Кофейная культура
            Алматы») в одну колонку не помещаются. */}
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Сетка, а не лента: перенос по рядам и одинаковый просвет по обеим осям
  // (макет — ряды 3566:7284 и 3566:7305, gap 12).
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: guideLayout.rubricGap,
    rowGap: guideLayout.rubricGap,
  },
  card: {
    height: guideLayout.rubricCardHeight,
    borderRadius: radius.guideRubric,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: guideLayout.rubricCardPadding,
    backgroundColor: colors.background.chip,
  },
  pressed: {
    opacity: 0.7,
  },
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  copy: {
    gap: guideLayout.rubricTextGap,
  },
  eyebrow: {
    ...typography.guideRubricEyebrow,
    color: colors.guide.gold,
  },
  title: {
    ...typography.guideRubricTitle,
    color: colors.text.onDark,
  },
});
