import type { GuideCollectionVenue } from "@bookeat/api";
import { brandPageLayout, colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CaretRight } from "../icons";
import { PhotoRail } from "../PhotoRail";

const t = getDictionary();

/**
 * Кадр в ленте блока. Ширина 256 осталась прежней (кадр УЖЕ карточки, поэтому
 * вторая фотография видна краем и лента читается как лента), а высота
 * поднялась со 148 до 215 — столько в новом макете страницы подборки
 * (3z0f6dgev4HMwBAHPjTjPo, node 3441:12290, «Restaurant photo»).
 */
export const GUIDE_PHOTO_WIDTH = 256;
export const GUIDE_PHOTO_HEIGHT = brandPageLayout.venueCardPhotoHeight;

/** Instagram as the design writes it — «@handle», not a URL. The venue field
 * holds whatever the cabinet typed: a full link, a bare handle, sometimes with
 * a trailing slash. Everything before the handle is dropped and one «@» is put
 * back, so «https://instagram.com/mongol.almaty/» and «mongol.almaty» print
 * identically. A value that survives to nothing (a bare link to the site root)
 * prints nothing rather than a lone «@». */
export function instagramHandle(raw: string): string {
  const handle = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
  return handle ? `@${handle}` : "";
}

/**
 * Нижняя подпись блока — «адрес · @инстаграм» (node 1013:13736).
 *
 * В макете это ТРИ отдельных элемента: адрес и ник в 14/20, а точка между ними
 * в 12/16, — поэтому строка не склеивается в один `Text`, и разделитель здесь
 * решается данными, а не пробелами в шаблоне. Точка появляется только когда
 * есть обе части: иначе подпись начиналась бы или кончалась висящей точкой.
 */
export function guideFooterParts(
  address: string,
  instagram: string,
): { address: string; handle: string; separator: boolean } | null {
  const trimmedAddress = address.trim();
  const handle = instagramHandle(instagram);
  if (!trimmedAddress && !handle) return null;
  return {
    address: trimmedAddress,
    handle,
    separator: Boolean(trimmedAddress) && Boolean(handle),
  };
}

/**
 * One venue block of a «Статья» (collection) detail.
 *
 * Two shapes, one component, because the payload has two:
 *  - a plain venue card — the name, the venue's photo, the editor's note;
 *  - the design's richer block (node 1001:11921), when the editor illustrated
 *    the venue with an EVENT or a PROMO: the item's own title and text over a
 *    RAIL of its photos, which is why the gallery was added server-side at all.
 *
 * The footer is the design's «адрес · @инстаграм». The instagram belongs to the
 * VENUE (the collection payload carries the venue's own link); when the venue
 * has none the separator goes with it rather than leaving a dangling «·».
 *
 * The whole block is one button that opens the restaurant screen — including
 * the highlighted variant: a guest reading about the venue's Wednesday event
 * wants the venue, and the event has its own card elsewhere in the app.
 */
export function GuideVenueBlock({
  venue,
  onPress,
}: {
  venue: GuideCollectionVenue;
  onPress: (restaurantId: string) => void;
}) {
  const highlight = venue.highlight;
  const photos = highlight ? [highlight.coverImageUrl, ...highlight.images] : [venue.imageUrl];
  const footer = guideFooterParts(venue.address, venue.instagram);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.articles.openVenue(venue.name)}
      onPress={() => onPress(venue.restaurantId)}
      style={({ pressed }) => [styles.block, pressed && styles.pressed]}
    >
      {/* ФОТОГРАФИЯ ТЕПЕРЬ СВЕРХУ И БЕЗ БОКОВОГО ОТСТУПА. В макете страницы
          подборки (node 3441:12290) кадр занимает всю ширину карточки и
          упирается в её скруглённые углы — прежние 8 от края и порядок
          «название, потом кадр» ушли вместе со старым макетом.

          Кадр фиксированный (256), а не по ширине карточки: лента уезжает за
          правый край блока, и обрезает её `overflow: hidden` самого блока.
          Одну фотографию `PhotoRail` рисует во всю ширину. */}
      <PhotoRail
        uris={photos}
        height={GUIDE_PHOTO_HEIGHT}
        inset={0}
        frameWidth={GUIDE_PHOTO_WIDTH}
        borderRadius={0}
        showDots={false}
      />

      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          {/* Город заглавными с разрядкой — надпись над названием из макета
              (node 3441:12292). Пустой город означает отсутствие строки, а не
              выдуманную: подставлять сюда «Алматы» нельзя. */}
          {venue.city.trim() ? (
            <Text style={styles.city} numberOfLines={1} ellipsizeMode="tail">
              {venue.city.trim().toUpperCase()}
            </Text>
          ) : null}
          <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
            {venue.name}
          </Text>
        </View>
        <CaretRight size={24} color={colors.brand2.muted} weight="regular" />
      </View>

      <View style={styles.textGroup}>
        {/* Заголовок и текст события/акции — над адресом заведения, как в макете.
            У простого блока их нет, и остаётся редакционная заметка. */}
        {highlight?.title ? <Text style={styles.highlightTitle}>{highlight.title}</Text> : null}
        {highlight?.description ? <Text style={styles.note}>{highlight.description}</Text> : null}
        {venue.note ? <Text style={styles.note}>{venue.note}</Text> : null}

        {/* Адрес — строкой, без иконки: в макете (node 1013:13736) это подпись
            «адрес · @инстаграм», а не пункт с пином. */}
        {footer ? (
          <View style={styles.footer}>
            {footer.address ? (
              <Text style={styles.address} numberOfLines={2} ellipsizeMode="tail">
                {footer.address}
              </Text>
            ) : null}
            {footer.separator ? <Text style={styles.separator}>·</Text> : null}
            {footer.handle ? (
              <Text style={styles.handle} numberOfLines={1} ellipsizeMode="tail">
                {footer.handle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.background.surface,
    // 16 из макета страницы подборки (node 3441:12289) — было 24
    // (`radius.contentBlock`) от старого белого блока на сером листе.
    borderRadius: radius.brandCard,
    borderWidth: 1,
    borderColor: colors.brand2.cardBorder,
    // Лента фотографий шире карточки и должна упираться в её край, а не
    // вылезать наружу.
    overflow: "hidden",
    // Сверху отступа НЕТ: там фотография во всю ширину карточки.
    paddingBottom: brandPageLayout.contentPaddingHorizontal,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  titleRow: {
    paddingHorizontal: brandPageLayout.contentPaddingHorizontal,
    paddingTop: brandPageLayout.contentPaddingHorizontal,
    flexDirection: "row",
    // Шеврон стоит у ВЕРХНЕЙ строки заголовка, а не по центру блока из двух
    // строк.
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleGroup: {
    flexShrink: 1,
    gap: spacing.sm,
  },
  city: {
    ...typography.brandVenueCity,
    color: colors.brand2.goldMuted,
  },
  name: {
    ...typography.brandVenueName,
    color: colors.brand2.navy,
  },
  textGroup: {
    paddingHorizontal: brandPageLayout.contentPaddingHorizontal,
    gap: spacing.sm,
  },
  highlightTitle: {
    ...typography.brandTitleSm,
    color: colors.brand2.navy,
  },
  note: {
    ...typography.brandBody,
    color: colors.brand2.navy,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  address: {
    ...typography.brandBody,
    color: colors.brand2.muted,
    // Длинный адрес («Микрорайон Мирас, 2, Бостандыкский район») на экране
    // 360 pt сжимается и переносится, а не выталкивает ник за край.
    flexShrink: 1,
  },
  separator: {
    ...typography.brandCaption,
    color: colors.brand2.muted,
  },
  handle: {
    ...typography.brandBody,
    color: colors.brand2.muted,
    flexShrink: 1,
  },
});
