import { colors, eventHero, radius, typography } from "@bookeat/design-tokens";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PhotoRail } from "../PhotoRail";

/**
 * Шапка карточки афиши — макет 3z0f6dgev4HMwBAHPjTjPo, узлы 3452:13224…13250
 * («Hero / Editorial»).
 *
 * ЧТО ИЗМЕНИЛОСЬ (правка владельца 2026-08-27). Было: фотография 240 в белой
 * рамке с полями 12, под ней на белом название, подпись и бордовые метки.
 * Стало: фотография 350 во всю ширину, поверх неё градиент, а название,
 * подпись и метки лежат НА фотографии в её нижнем углу. Кнопки «назад»,
 * «в избранное» и «поделиться» тоже переехали на кадр.
 *
 * Лента фотографий сохранена: у события может быть галерея сверх обложки. В
 * макете точек под лентой нет (подпись занимает их место), поэтому листание
 * видно по самой фотографии — `showDots={false}`.
 *
 * ЭТОТ ЖЕ КАДР СТОИТ НА КАРТОЧКЕ СТАТЬИ (правка владельца 28.08.2026) И НА
 * КАРТОЧКЕ АКЦИИ (правка владельца «карточка акции должна быть такой же, как
 * афиша и карточка заведения, по структуре»). Ничего специфично-«афишного»
 * внутри нет: он принимает фотографии, название, подпись и метки.
 *
 * Кнопки принимает пропсами, а не рисует сама: сердечко знает про избранное,
 * «поделиться» — про системный шит, и обоим здесь не место.
 */
export function EventHero({
  photos,
  title,
  subtitle,
  tags,
  badge,
  topInset,
  backButton,
  actions,
}: {
  /** Обложка и галерея в порядке показа; пустые значения отсеет `PhotoRail`. */
  photos: (string | null | undefined)[];
  title: string;
  subtitle?: string;
  tags: string[];
  /**
   * Одна выделенная метка перед остальными — фирменной плашкой, а не серой
   * пилюлей. Заведена для карточки АКЦИИ: её «−20 %» это не метка в ряду
   * прочих, а сама суть акции, и в списке она уже нарисована фирменным цветом
   * (`PromotionListCard`, проп `badge`). У афиши её нет — там пилюли равны
   * между собой.
   */
  badge?: string;
  /** Верхняя безопасная зона устройства — кнопки лежат на 14 ниже неё. */
  topInset: number;
  backButton: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <View style={styles.hero}>
      {/* Белая полоса под статус-баром: в макете (3452:13224) кадр начинается
          НИЖЕ безопасной зоны, а не уходит под часы. Высота берётся у
          устройства — 44 в макете это статус-бар конкретного айфона. */}
      <View style={{ height: topInset }} />

      <View style={styles.photoBlock}>
        <PhotoRail
          uris={photos}
          height={eventHero.photoHeight}
          inset={0}
          borderRadius={radius.photoHero}
          showDots={false}
        />

        {/* Затемнение — отдельным слоем поверх ленты: подпись белая, и на
            светлом кадре без него она пропадает. Касания не перехватывает,
            иначе ленту нельзя было бы листать. */}
        <LinearGradient
          colors={colors.overlay.eventHeroGradient}
          locations={[0, 0.498, 1]}
          style={[StyleSheet.absoluteFill, styles.scrim]}
          pointerEvents="none"
        />

        <View style={styles.caption}>
          <View style={styles.captionText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {badge || tags.length > 0 ? (
            <View style={styles.tags}>
              {badge ? (
                <View style={[styles.pill, styles.badgePill]}>
                  <Text style={styles.pillText} numberOfLines={1} ellipsizeMode="tail">
                    {badge}
                  </Text>
                </View>
              ) : null}
              {tags.map((tag, index) => (
                <View key={`${tag}-${index}`} style={styles.pill}>
                  {/* Метка всегда в одну строку: перенос ломал бы высоту ряда,
                      который прижат к низу кадра. */}
                  <Text style={styles.pillText} numberOfLines={1} ellipsizeMode="tail">
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.controls, { top: topInset + eventHero.controlTop }]}>
        {backButton}
        <View style={styles.controlGroup}>{actions}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.background.surface,
  },
  photoBlock: {
    height: eventHero.photoHeight,
  },
  // Градиент повторяет скругление кадра, иначе тёмные углы вылезали бы за него.
  scrim: {
    borderRadius: radius.photoHero,
  },
  controls: {
    position: "absolute",
    left: eventHero.controlInset,
    right: eventHero.controlInset,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlGroup: {
    flexDirection: "row",
    gap: eventHero.controlGap,
  },
  caption: {
    position: "absolute",
    left: eventHero.contentInset,
    right: eventHero.contentInset,
    bottom: eventHero.contentBottom,
    gap: eventHero.contentGap,
  },
  captionText: {
    gap: eventHero.titleGap,
  },
  title: {
    ...typography.eventHeroTitle,
    color: colors.text.onDark,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.onDark,
  },
  tags: {
    flexDirection: "row",
    gap: eventHero.pillGap,
  },
  pill: {
    backgroundColor: colors.overlay.heroPill,
    borderRadius: radius.pill,
    paddingHorizontal: eventHero.pillPaddingH,
    paddingVertical: eventHero.pillPaddingV,
    // Ряд не переносится (в макете `overflow-clip`), поэтому длинный набор
    // меток обрезается краем кадра, а не уезжает вторым рядом на фотографию.
    flexShrink: 1,
  },
  badgePill: {
    backgroundColor: colors.brand.primary,
  },
  pillText: {
    ...typography.captionMedium,
    color: colors.text.onDark,
  },
});
