import { colors, guideLayout, listCard, radius, typography } from "@bookeat/design-tokens";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "../PhotoView";

/**
 * Большая карточка гастрогида «Editorial v2» (Figma 3z0f6dgev4HMwBAHPjTjPo):
 * фотография во всю ширину контента, скругление 24, затемнение снизу и
 * текст ПОВЕРХ фотографии в нижнем левом углу.
 *
 * ЭТО ЗАМЕНА ДВУМ КАРТОЧКАМ СРАЗУ — `ArticleListCard` (подборка) и
 * `GuideRouteCard` (гастропрогулка). Обе рисовали одно и то же: обложку, под
 * ней название и строку описания. В новом макете обе стали одной карточкой с
 * текстом на фотографии, и держать под неё два почти одинаковых файла больше
 * незачем.
 *
 * ДВА ВИДА, ОДИН КОМПОНЕНТ, потому что в макете они отличаются ровно тремя
 * числами:
 *
 *   • `editorPick` (node 3192:6266) — 214 высотой, затемнение 85 % от самого
 *     верха, три строки (золотая надпись, название, строка-справка), просвет 5;
 *   • `walk` (узлы 3192:6275, 3192:6279) — 206 высотой (то же число, что
 *     `listCard.coverHeight`), затемнение 82 % от четверти высоты, две строки,
 *     просвет 4.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: сердечка. Избранное на бэкенде знает про заведения, события
 * и акции, но не про подборки и не про маршруты. Инертное сердечко из этого
 * приложения уже убирали — вернётся, когда появится ручка.
 */

export type GuideEditorialVariant = "editorPick" | "walk";

export function GuideEditorialCard({
  variant,
  coverImageUrl,
  eyebrow,
  title,
  summary,
  accessibilityLabel,
  onPress,
}: {
  variant: GuideEditorialVariant;
  coverImageUrl: string | null;
  /** Золотая надпись над названием. Есть только у «Выбора редакции», и только
   * когда редакция заполнила подзаголовок — выдумывать её нечем. */
  eyebrow?: string;
  title: string;
  /** Строка под названием. Пустая — строки просто не будет. */
  summary?: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const editorPick = variant === "editorPick";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        editorPick ? styles.cardEditorPick : styles.cardWalk,
        pressed && styles.pressed,
      ]}
    >
      <PhotoView
        uri={coverImageUrl}
        style={styles.photo}
        decorative
        priority="high"
        placeholderIconSize={40}
      />
      <LinearGradient
        colors={[
          colors.guide.scrimStart,
          editorPick ? colors.guide.editorPickScrimEnd : colors.guide.walkScrimEnd,
        ]}
        // «Выбор редакции» гасится от самого верха кадра (под ним три строки
        // текста), гастропрогулка — от четверти высоты.
        locations={editorPick ? [0, 1] : [0.25, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />
      <View style={[styles.copy, editorPick ? styles.copyEditorPick : styles.copyWalk]}>
        {eyebrow ? (
          <Text style={styles.eyebrow} numberOfLines={1} ellipsizeMode="tail">
            {eyebrow}
          </Text>
        ) : null}
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
        {summary ? (
          // Редакционный текст подборки бывает в несколько экранов — две
          // строки с многоточием, как в макете; целиком он читается внутри.
          <Text
            style={editorPick ? styles.meta : styles.body}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: radius.guideCard,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.background.chip,
  },
  cardEditorPick: {
    height: guideLayout.editorPickHeight,
  },
  cardWalk: {
    height: listCard.coverHeight,
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
    paddingHorizontal: guideLayout.cardPaddingHorizontal,
    paddingVertical: guideLayout.cardPaddingVertical,
  },
  copyEditorPick: {
    gap: guideLayout.editorPickTextGap,
  },
  copyWalk: {
    gap: guideLayout.walkTextGap,
  },
  eyebrow: {
    ...typography.guideCardEyebrow,
    color: colors.guide.gold,
  },
  title: {
    ...typography.guideCardTitle,
    color: colors.text.onDark,
  },
  meta: {
    ...typography.guideCardMeta,
    color: colors.guide.cardMeta,
  },
  body: {
    ...typography.guideCardBody,
    color: colors.guide.cardBody,
  },
});
