import { colors, oceanPageLayout, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { openInstagram } from "../../lib/external-links";
import { Anchor, ArrowRight, InstagramLogo } from "../icons";
import { OCEAN_BASKET_INSTAGRAM, spacedOut } from "./ocean-basket-content";

const t = getDictionary();

/**
 * ЗАМЫКАЮЩАЯ СВЯЗКА страницы — макет 3z0f6dgev4HMwBAHPjTjPo, узлы
 * 3443:12562…3443:12587: круг с якорем, «ПРОДОЛЖЕНИЕ СЛЕДУЕТ · …в твоей
 * тарелке», блок инстаграма и синий блок с золотой кнопкой.
 *
 * БЛОК ИНСТАГРАМА ВЕДЁТ В ИНСТАГРАМ — это единственная живая ссылка страницы
 * кроме карточек точек. Ленты постов здесь НЕТ и не обещано: интеграции с
 * Instagram Graph API у бэкенда нет, а слово «лента» без ленты было бы
 * враньём. В макете нарисована ровно эта строка с ником и стрелкой.
 *
 * КНОПКА «ЗАБРОНИРОВАТЬ» ПРОКРУЧИВАЕТ К СПИСКУ ТОЧЕК, а не открывает форму
 * брони: точек три, и выбрать за гостя, в какой из них бронировать, страница
 * не вправе. Заголовок блока в макете так и написан — «Выберите точку на
 * карте».
 */
export function OceanClosingSection({ onBook }: { onBook: () => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sign}>
        <View style={styles.anchorCircle}>
          <Anchor size={30} color={colors.brand2.gold} weight="regular" />
        </View>
        <View style={styles.signText}>
          <Text style={styles.eyebrow} accessibilityLabel={t.oceanBasket.closingEyebrow}>
            {spacedOut(t.oceanBasket.closingEyebrow)}
          </Text>
          <Text style={styles.closingTitle}>{t.oceanBasket.closingTitle}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t.oceanBasket.instagramA11y}
        onPress={() => void openInstagram(OCEAN_BASKET_INSTAGRAM)}
        style={({ pressed }) => [styles.instagram, pressed && styles.pressed]}
      >
        <View style={styles.instagramIcon}>
          <InstagramLogo size={22} color={colors.brand2.gold} weight="regular" />
        </View>
        <View style={styles.instagramText}>
          <Text style={styles.instagramHandle} numberOfLines={1}>
            {t.oceanBasket.instagramHandle}
          </Text>
          <Text style={styles.instagramNote} numberOfLines={2}>
            {t.oceanBasket.instagramNote}
          </Text>
        </View>
        <ArrowRight size={18} color={colors.brand2.goldChevron} weight="regular" />
      </Pressable>

      <View style={styles.cta}>
        <Text style={styles.ctaEyebrow} accessibilityLabel={t.oceanBasket.ctaEyebrow}>
          {spacedOut(t.oceanBasket.ctaEyebrow)}
        </Text>
        <Text style={styles.ctaTitle}>{t.oceanBasket.ctaTitle}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.oceanBasket.ctaA11y}
          onPress={onBook}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
        >
          <Text style={styles.ctaButtonLabel}>{t.oceanBasket.ctaAction}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xxl,
  },
  sign: {
    alignItems: "center",
    gap: spacing.md,
  },
  anchorCircle: {
    width: oceanPageLayout.anchorCircle,
    height: oceanPageLayout.anchorCircle,
    borderRadius: oceanPageLayout.anchorCircle / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand2.navy,
    borderWidth: oceanPageLayout.anchorRingWidth,
    borderColor: colors.brand2.anchorRing,
  },
  signText: {
    alignItems: "center",
    gap: 6,
  },
  eyebrow: {
    ...typography.brandSpacedLabel,
    color: colors.brand2.gold,
    textAlign: "center",
  },
  closingTitle: {
    ...typography.brandClosingTitle,
    color: colors.brand2.navy,
    textAlign: "center",
  },
  instagram: {
    minHeight: oceanPageLayout.instagramHeight,
    borderRadius: oceanPageLayout.instagramRadius,
    backgroundColor: colors.brand2.accentSurface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
  instagramIcon: {
    width: oceanPageLayout.instagramIconSize,
    height: oceanPageLayout.instagramIconSize,
    borderRadius: oceanPageLayout.instagramIconRadius,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand2.navy,
  },
  instagramText: {
    flexShrink: 1,
    flexGrow: 1,
    gap: 4,
  },
  instagramHandle: {
    ...typography.brandButtonLabel,
    color: colors.brand2.navy,
  },
  instagramNote: {
    ...typography.brandCaptionTight,
    color: colors.brand2.muted,
  },
  cta: {
    // В макете высота ровно 150, но заголовок переводится: у казахского и
    // английского он длиннее, поэтому 150 — это МИНИМУМ, а не потолок.
    minHeight: oceanPageLayout.ctaHeight,
    borderRadius: oceanPageLayout.ctaRadius,
    backgroundColor: colors.brand2.navyDeep,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  ctaEyebrow: {
    ...typography.brandSpacedLabel,
    color: colors.brand2.gold,
    textAlign: "center",
  },
  ctaTitle: {
    ...typography.brandTitleLg,
    color: colors.brand2.ctaOnNavy,
    textAlign: "center",
  },
  ctaButton: {
    borderRadius: oceanPageLayout.ctaButtonRadius,
    backgroundColor: colors.brand2.gold,
    paddingHorizontal: oceanPageLayout.ctaButtonPaddingHorizontal,
    paddingVertical: oceanPageLayout.ctaButtonPaddingVertical,
  },
  ctaButtonLabel: {
    ...typography.brandButtonLabel,
    color: colors.brand2.navy,
    textAlign: "center",
  },
});
