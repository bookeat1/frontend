import type { GuideCollection } from "@bookeat/api";
import { colors, guideLayout, radius, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Ряд «Рубрики» гастрогида — макет «Editorial v2» (Figma
 * 3z0f6dgev4HMwBAHPjTjPo, узлы 3192:6258 и 3192:6133): ГОРИЗОНТАЛЬНАЯ лента
 * плиток 118×158 со скруглением 22, просвет 8. На плитке фотография,
 * затемнение снизу и две надписи в нижнем левом углу — золотая рубрика и
 * белое название.
 *
 * БЫЛО: сетка в две колонки, кадр 128 со скруглением 20, подписи ПОД
 * фотографией (`GuideCollectionGrid`, старый файл dVjT37j984ErvOmzxlx29p,
 * node 1099:6837). Новый макет переносит текст НА фотографию и разворачивает
 * сетку в ленту — это не правка отступов, а другая карточка.
 *
 * ЧЕМ КОРМИТСЯ. Той же подборкой, что и раньше: гостевая ручка рубрик
 * (`GET /gastroguide/categories`) отдаёт `{id, slug, title, position}` — ни
 * обложки, ни картинки, и плитка из неё выходила пустой плашкой. У подборки
 * есть `cover_image_url`, а её `categorySlugs` дают ту самую золотую надпись
 * сверху. Обложки нет — стандартная плашка «фото нет», выдуманной картинки
 * тут не будет.
 *
 * Плитка ОТКРЫВАЕТ ПОДБОРКУ (`/articles/:slug`), а не отбирает список под
 * собой: прежний отбор был нашей выдумкой и снят по итогам просмотра на
 * устройстве.
 */

export function GuideRubricRail({
  collections,
  onPress,
}: {
  collections: GuideCollection[];
  onPress: (slug: string) => void;
}) {
  if (collections.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Лента уезжает под правый край листа контента: поля 16 стоят у листа, а
      // не у ленты, поэтому лента их гасит отрицательным отступом и ставит
      // свои — иначе последняя плитка упиралась бы в невидимую стену за 16 до
      // края экрана и лента не читалась бы как лента.
      style={styles.rail}
      contentContainerStyle={styles.railContent}
    >
      {collections.map((collection) => (
        <RubricCard key={collection.slug} collection={collection} onPress={onPress} />
      ))}
    </ScrollView>
  );
}

/**
 * Золотая надпись на плитке — рубрика подборки заглавными.
 *
 * Берётся ПЕРВЫЙ слаг из `categorySlugs`: в этой ленте только те подборки, у
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

function RubricCard({
  collection,
  onPress,
}: {
  collection: GuideCollection;
  onPress: (slug: string) => void;
}) {
  const summary = collection.subtitle || collection.description;
  const label = rubricLabel(collection.categorySlugs);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={summary ? t.articles.card(collection.title, summary) : collection.title}
      onPress={() => onPress(collection.slug)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PhotoView
        uri={collection.coverImageUrl}
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
        {label ? (
          <Text style={styles.eyebrow} numberOfLines={1} ellipsizeMode="tail">
            {label}
          </Text>
        ) : null}
        {/* Две строки, как в макете: живые названия («Кофейная культура
            Алматы») в 118 pt ширины в одну не помещаются. */}
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {collection.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    marginHorizontal: -guideLayout.contentPaddingHorizontal,
  },
  railContent: {
    paddingHorizontal: guideLayout.contentPaddingHorizontal,
    gap: guideLayout.rubricGap,
  },
  card: {
    width: guideLayout.rubricCardWidth,
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
