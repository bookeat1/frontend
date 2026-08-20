import type { GuideCollection } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Карточка подборки в списке гастрогида (макет
 * dVjT37j984ErvOmzxlx29p, node 1100:7102): обложка 148 со скруглением 20,
 * под ней название и одна строка описания. Вся карточка — одна кнопка,
 * открывающая подборку (`/articles/:slug`).
 *
 * СЕРДЕЧКА НЕТ, хотя в макете оно нарисовано в правом верхнем углу кадра:
 * избранное на бэкенде покрывает заведения, события и акции — подборок в нём
 * нет. Нарисовать сердечко значило бы завести контрол, который ничего не
 * запоминает; такое из этого приложения уже убирали (см. память команды,
 * fake-favorite-heart). Появится ручка — сердечко вернётся сюда.
 *
 * Вторая строка — `subtitle`, а при его отсутствии начало `description`:
 * у живых подборок подзаголовок чаще пустой, а весь редакционный текст лежит
 * в описании, и строка из макета иначе просто не заполнилась бы. Никакой
 * выдуманной подписи («От BookEat» и прочего) тут нет.
 */

/** Высота обложки (node 1100:7103). */
const COVER_HEIGHT = 148;

export function ArticleListCard({
  collection,
  onPress,
}: {
  collection: GuideCollection;
  onPress: (slug: string) => void;
}) {
  const summary = collection.subtitle || collection.description;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={summary ? t.articles.card(collection.title, summary) : collection.title}
      onPress={() => onPress(collection.slug)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <PhotoView
        uri={collection.coverImageUrl}
        style={styles.cover}
        decorative
        placeholderIconSize={40}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {collection.title}
        </Text>
        {summary ? (
          // Описание подборки бывает в несколько экранов текста — две строки
          // с многоточием, как в макете; целиком оно читается внутри подборки.
          <Text style={styles.summary} numberOfLines={2} ellipsizeMode="tail">
            {summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  cover: {
    width: "100%",
    height: COVER_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  body: {
    paddingHorizontal: spacing.xs,
    gap: spacing.xxs,
  },
  title: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  summary: {
    ...typography.body,
    color: colors.text.muted,
  },
});
