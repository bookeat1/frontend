import type { PromoBanner } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PhotoView } from "./PhotoView";

const BANNER_WIDTH = 104;
const BANNER_HEIGHT = 120;

/** Promo banner strip under the Обзор/Фото tabs — Figma nodes 340:2574–340:2589. */
export function PromoBannerStrip({ banners }: { banners: PromoBanner[] }) {
  if (banners.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {banners.map((banner) => (
          <View key={banner.id} style={styles.banner}>
            {/* Промо из API приходит без картинки — тогда остаётся плитка
                фирменного цвета с подписью, а не битая ссылка. */}
            {/* Подпись поверх плитки уже несёт весь смысл баннера, поэтому
                картинка декоративна; без картинки — плитка фирменного цвета,
                без прибора, чтобы не спорить с подписью. */}
            <PhotoView
              uri={banner.photo?.uri}
              style={styles.image}
              decorative
              placeholderIcon={false}
              // Подпись баннера белая и лежит прямо на плитке — на светло-сером
              // её не прочитать, поэтому «фото нет» здесь остаётся фирменного
              // цвета, ровно как было до общего компонента.
              placeholderColor={colors.background.bannerPlaceholder}
            />
            <LinearGradient
              colors={[colors.overlay.bannerGradientTop, colors.overlay.bannerGradientBottom]}
              style={styles.gradient}
            />
            <Text style={styles.caption} numberOfLines={2}>
              {banner.title}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  banner: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: spacing.md,
    backgroundColor: colors.background.bannerPlaceholder,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BANNER_HEIGHT * 0.65,
  },
  caption: {
    ...typography.bannerCaption,
    color: colors.text.onDark,
  },
});
