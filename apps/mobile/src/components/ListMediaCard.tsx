import { colors, listCard, radius, typography } from "@bookeat/design-tokens";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "./PhotoView";

/**
 * ОДНА карточка вертикального списка на всё приложение — «Card / Flour Demi»
 * из макета (Figma 3z0f6dgev4HMwBAHPjTjPo, node 3452:13344; тот же узел лежит
 * в новом экране поиска 918:12539 и в референсе 347:5942).
 *
 * Что в ней нарисовано и почему именно так:
 *
 *  - карточка целиком — снимок высотой 198 со скруглением 22 и мягкой тенью;
 *    отдельного текстового блока ПОД снимком больше нет;
 *  - название и подпись лежат ВНУТРИ снимка, прижатые к низу, с полями 18;
 *  - читаемость держит вертикальный градиент (прозрачный → 20% → 86% чёрного),
 *    а не тень у текста: на светлом зале тень не спасала;
 *  - в правом верхнем углу — необязательный слот (сегодня это сердечко
 *    избранного) и необязательный бейдж слева (скидка акции).
 *
 * Раньше на этих экранах жили ЧЕТЫРЕ почти одинаковые карточки —
 * `RestaurantCard`, `FavoriteMediaCard`, `ArticleListCard` и их копии,
 * — которые расходились в высоте обложки, отступах и месте названия. Владелец
 * попросил (2026-08-27) привести избранное, статьи и все листинги к виду
 * страницы поиска, поэтому геометрия живёт здесь одна на всех, а экраны
 * приносят только СОДЕРЖИМОЕ.
 *
 * ГДЕ ЭТО РАБОТАЕТ СЕГОДНЯ: поиск, избранное, акции и лента статей на главной.
 * Экран гастрогида в тот же день переехал на журнальный макет «Editorial v2»
 * со своей карточкой `GuideEditorialCard` (текст на фотографии, но с золотой
 * надписью, своей точкой старта градиента и двумя высотами). Правило
 * «название внутри снимка» у них общее, геометрия — разная, и до появления
 * варианта с настраиваемым градиентом здесь это два компонента, а не один.
 *
 * Компонент намеренно тупой: ни запросов, ни состояния избранного. Сердечку
 * нужен хук — его приносит вызывающий через `overlay`, ровно как это делала
 * `RestaurantCard` до неё.
 */
export function ListMediaCard({
  title,
  subtitle,
  note,
  coverUri,
  overlay,
  badge,
  onPress,
  accessibilityLabel,
  titleLines = 2,
}: {
  title: string;
  /** Одна строка под названием: «Европейская · 8 000–15 000 ₸» у заведения,
   * «18 мая · 13:00» у события. Пусто — строки просто нет. */
  subtitle?: string;
  /**
   * Ещё одна необязательная строка ПОД подписью — сегодня только «В меню:
   * <блюдо>» в выдаче поиска, когда заведение нашлось по меню.
   *
   * Отдельный слот, а не склейка с `subtitle`: подпись однострочная и уже
   * занята («Европейская · ₸₸»), а дописать туда блюдо значило бы обрезать
   * многоточием либо кухню, либо блюдо. Экраны, которые её не передают
   * (избранное, статьи, акции, подборки), рисуются ровно как раньше.
   */
  note?: string;
  coverUri?: string | null;
  /** Абсолютно позиционированный элемент поверх снимка — сердечко избранного.
   * Слот, а не встроенный флаг: в списках без избранного он не должен тянуть
   * за собой запрос. */
  overlay?: React.ReactNode;
  /** Красный бейдж в левом верхнем углу — сегодня только «−30%» у акции. */
  badge?: string;
  onPress: () => void;
  accessibilityLabel: string;
  /** Название заведения — одна строка (в макете оно короткое), заголовок
   * события или подборки — две: живые названия там длиннее ширины карточки. */
  titleLines?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Внутренний слой обрезает содержимое по скруглению, а тень живёт на
          внешнем: `overflow: hidden` на том же View, что и тень, срезает её
          саму — и на iOS, и на Android. */}
      <View style={styles.clip}>
      {/* Снимок декоративен: всё, что он говорит, уже сказано в
          accessibilityLabel карточки. Заведение без фото и заведение с
          отвалившимся фото выглядят одинаково — нейтральная плашка. */}
      <PhotoView
        uri={coverUri ?? undefined}
        style={styles.cover}
        decorative
        placeholderIconSize={40}
      />
      {/* Градиент из макета тремя точками, а не двумя: между прозрачным верхом
          и почти чёрным низом стоит 20% на половине высоты — без неё переход
          виден полосой на однотонных снимках. */}
      <LinearGradient
        colors={[
          colors.overlay.listCardScrimTop,
          colors.overlay.listCardScrimMid,
          colors.overlay.listCardScrimBottom,
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {overlay ? (
        <View style={styles.overlayLayer} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={titleLines} ellipsizeMode="tail">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
        {note ? (
          <Text style={styles.note} numberOfLines={1} ellipsizeMode="tail">
            {note}
          </Text>
        ) : null}
      </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: listCard.coverHeight,
    borderRadius: radius.listCard,
    // Тень из макета: `0px 6px 20px -6px rgba(0,0,0,0.1)`. Отрицательный
    // spread у RN не выражается, поэтому радиус размытия взят вдвое меньше
    // нарисованных 20 — так пятно получается примерно того же размера.
    // Android умеет только `elevation`; 3 даёт похожую мягкость.
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  clip: {
    flex: 1,
    borderRadius: radius.listCard,
    overflow: "hidden",
    backgroundColor: colors.background.chip,
    justifyContent: "flex-end",
  },
  pressed: {
    opacity: 0.9,
  },
  cover: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  content: {
    paddingHorizontal: listCard.contentPadding,
    paddingBottom: listCard.contentPadding,
    // 2 между названием и подписью (node 3452:13348: `gap-[2px]`).
    gap: 2,
  },
  title: {
    ...typography.displayCard,
    color: colors.text.onDark,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.onDarkMuted,
  },
  note: {
    // Тем же кеглем, что и подпись, но не приглушённая: это ОТВЕТ на запрос
    // гостя («почему это заведение здесь»), а не второстепенная справка.
    ...typography.captionMedium,
    color: colors.text.onDark,
  },
  overlayLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  badge: {
    position: "absolute",
    top: listCard.overlayButtonInset,
    left: listCard.contentPadding,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
  },
  badgeText: {
    ...typography.captionMedium,
    color: colors.text.onBrand,
  },
});
