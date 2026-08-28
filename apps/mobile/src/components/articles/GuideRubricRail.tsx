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
 * КУДА ВЕДЁТ ПЛИТКА. Она нарисована как РУБРИКА, поэтому и открывает экран
 * рубрики (`/gastroguide/rubric/:categorySlug`, node 3492:13723), а не
 * подборку, из которой её собрали. Отбирать список под собой она по-прежнему
 * не отбирает: прежний отбор был нашей выдумкой и снят по итогам просмотра на
 * устройстве.
 *
 * БЫЛО `/articles/:slug` — страница той самой подборки. Экран рубрики
 * появился 2026-08-28 и показывает заведения ВСЕХ её подборок, поэтому
 * наружу уходит вся подборка целиком: решение, по какому слагу открывать
 * (рубрики или самой подборки), принимает экран, а не плитка.
 */

export function GuideRubricRail({
  collections,
  onPress,
}: {
  collections: GuideCollection[];
  /** Наружу уходит вся подборка: слаг рубрики лежит в её `categorySlugs`, и
   * выбирать между ним и слагом подборки — дело экрана. */
  onPress: (collection: GuideCollection) => void;
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
      {collections.map((collection) => {
        const summary = collection.subtitle || collection.description;
        return (
          <GuideRubricTile
            key={collection.slug}
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

/**
 * ПЛИТКА РУБРИКИ — единственная в приложении, и живёт она здесь.
 *
 * Её рисуют ДВА экрана: горизонтальная лента «Рубрики» на корне гастрогида
 * (плитка 118 шириной) и вертикальный список всех рубрик
 * (`/gastroguide/rubrics`, плитка во всю ширину листа). Второй экран
 * появился 2026-08-28 по правке владельца «лучше столбиком»; копии плитки
 * там нет намеренно — расходиться двум копиям куда проще, чем одному файлу.
 *
 * Отличается ровно одно — ширина, и она приходит пропом `fullWidth`. Высота,
 * скругление, затемнение, поля и обе надписи общие: это одна и та же карточка
 * макета (node 3192:6097).
 *
 * Надписи приходят пропами, а не собираются внутри: в ленте плитка подписана
 * ПОДБОРКОЙ (золотой слаг рубрики сверху, название подборки снизу), а в
 * списке — САМОЙ РУБРИКОЙ (её название из `GET /gastroguide/categories`, и
 * золотой надписи там нет: она повторяла бы заголовок).
 */
export function GuideRubricTile({
  coverImageUrl,
  eyebrow,
  title,
  accessibilityLabel,
  onPress,
  fullWidth = false,
}: {
  /** Обложки нет — стандартная плашка «фото нет», выдуманной картинки не будет. */
  coverImageUrl: string | null;
  /** Золотая надпись над названием. Пусто — надписи нет. */
  eyebrow?: string;
  title: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** Плитка тянется на всю ширину листа — вертикальный список рубрик. */
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        fullWidth ? styles.cardFullWidth : styles.cardRail,
        pressed && styles.pressed,
      ]}
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
            Алматы») в 118 pt ширины в одну не помещаются. */}
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
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
    height: guideLayout.rubricCardHeight,
    borderRadius: radius.guideRubric,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: guideLayout.rubricCardPadding,
    backgroundColor: colors.background.chip,
  },
  cardRail: {
    width: guideLayout.rubricCardWidth,
  },
  // В списке ширину задаёт лист, а не плитка: `alignSelf: "stretch"`, а не
  // `width: "100%"` — второе ломается, если однажды у списка появятся поля.
  cardFullWidth: {
    alignSelf: "stretch",
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
