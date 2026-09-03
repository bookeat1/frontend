import { brandPageLayout, colors, oceanPageLayout, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSheetAnimation } from "../../lib/sheet-animation";
import { BrandHeroControl } from "../articles/BrandHero";
import { CalendarCheck, Check, QrCode, Sparkle, Wine, X, type IconProps } from "../icons";
import { OceanHeroFish } from "./OceanHeroFish";

const t = getDictionary();

/**
 * ШТОРКА «WELCOME DRINK» — макет 3z0f6dgev4HMwBAHPjTjPo, узел 5012:5670 в
 * кадре 5012:5489 (спека `spec-welcome-drink-sheet-v2.md`): выезжает снизу по
 * плашке в шапке страницы. Тёмный герой с плашкой промо и карточкой, ниже на
 * кремовом листе — «Что входит» тремя галочками, три шага плитками и блок
 * «Условия».
 *
 * МЕХАНИКА — та же, что у остальных пяти шторок приложения
 * (`useSheetAnimation`): Modal без системной анимации, панель и затемнение
 * ведёт один прогресс. Затемнение здесь СВОЁ — чёрный 35 %
 * (`overlay.brandSheetScrim`), как измерено по рендеру макета, а не 45 %
 * диалогов.
 *
 * ОТСТУПЛЕНИЯ ОТ МАКЕТА, ОСОЗНАННЫЕ:
 *   • КРЕСТИК. В макете шторка закрывается только жестом за ручку — ни
 *     кнопки, ни крестика. Закрытие одним жестом — ловушка для части людей
 *     (скринридер, моторика, просто не догадался), поэтому крестик есть:
 *     поверх героя, как кнопки поверх шапки страницы. Тап по затемнению и
 *     системная «назад» тоже закрывают. Место под крестик в макете не
 *     предусмотрено, поэтому содержимое героя (плашка промо и карточка)
 *     опущено ПОД него: на 360 dp плашка «ПРОМО BOOKEAT x OCEAN BASKET»
 *     доходит до ≈ 315, а крестик начинается на 304 — в одной строке они
 *     пересекались, и hitSlop крестика съедал тапы по хвосту плашки. Герой
 *     из-за этого выше макетных 170 на высоту кнопки с просветом.
 *   • ЗАГОЛОВОК ВТОРОГО БЛОКА. В макете он повторяет «Что входит» — ошибка
 *     копирования; здесь «Как получить» (`welcomeSheet.stepsTitle`).
 *   • «Welcome drink» в карточке набрано Lobster 24 — шрифта в приложении
 *     нет, стоит Cormorant Garamond Bold 24 (`brandSectionTitle`), как у
 *     заголовков той же страницы.
 *   • Прозрачность плашки «ПРОМО…» из макета не выгружается (заливка и текст
 *     одного цвета); 22 % подобраны по рендеру.
 *
 * QR-КОДА ЗДЕСЬ НЕТ (решение владельца 2026-09-03): настоящего места под него
 * в макете нет — только иконка 32 в плитке шага «Покажите QR хостес», а
 * 32 pt для сканируемого кода мало. Шаг остаётся подписью, как нарисован.
 */
export function OceanWelcomeDrinkSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Шторка ≈ 743 pt на iPhone — выше общего хода 640, поэтому ход задаём сами:
  // панель ограничена 90 % окна и высоты окна ей хватает всегда. С ходом 640 на
  // экранах от 780 pt верх (ручка, крестик, плашка) торчал бы из-под низа.
  const { height: windowHeight } = useWindowDimensions();
  const { mounted, progress, translateY } = useSheetAnimation(visible, windowHeight);

  if (!mounted) return null;

  const sheet = t.oceanBasket.welcomeSheet;

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}
          testID="welcome-drink-backdrop"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            // Шторка в макете 727 при экране 844; на телефоне 640 высотой
            // она бы не влезла — потолок 90 % и прокрутка внутри.
            { maxHeight: "90%", transform: [{ translateY }] },
          ]}
          accessibilityViewIsModal
          testID="welcome-drink-sheet"
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + SHEET_BOTTOM_PADDING }}
          >
            {/* 01 / Hero (node 5012:5671): градиент, свечение, рыбы, плашка
                промо и карточка. */}
            <View style={styles.hero}>
              <LinearGradient
                colors={colors.brand2.heroGradient}
                locations={[0, 0.56, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.24 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <OceanHeroFish offsetTop={0} />

              <View style={styles.heroContent}>
                {/* Плашка промо (node 5012:5679): значок 16 (в макете
                    `si:ai-line`, здесь ближайший глиф Phosphor) и надпись,
                    просвет 4. */}
                <View style={styles.promoBadge}>
                  <Sparkle size={16} color={colors.brand2.gold} weight="regular" />
                  <Text style={styles.promoBadgeLabel} numberOfLines={1}>
                    {sheet.promoBadge}
                  </Text>
                </View>

                <View style={styles.card}>
                  <View style={styles.cardIcon}>
                    <Wine size={20} color={colors.text.primary} weight="regular" />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{sheet.title}</Text>
                    <Text style={styles.cardSubtitle}>{sheet.subtitle}</Text>
                  </View>
                </View>
              </View>

              {/* Ручка (node 5014:5756) — 40×4, белая, на 6 от верха. */}
              <View style={styles.handle} pointerEvents="none" />

              <View style={[styles.close, { top: CLOSE_TOP }]}>
                <BrandHeroControl
                  accessibilityLabel={t.a11y.closeButton}
                  onPress={onClose}
                  icon={<X size={20} color={colors.brand2.onNavy} weight="bold" />}
                />
              </View>
            </View>

            {/* 02 / Find your corner (node 5012:5691). */}
            <View style={styles.body}>
              <View style={styles.block}>
                <Text style={styles.blockTitle}>{sheet.includesTitle}</Text>
                <View style={styles.checkList}>
                  {sheet.includes.map((line) => (
                    <View key={line} style={styles.checkRow}>
                      <View style={styles.checkCircle}>
                        <Check size={12} color={colors.background.surface} weight="bold" />
                      </View>
                      <Text style={styles.checkLabel}>{line}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.block}>
                <Text style={styles.blockTitle}>{sheet.stepsTitle}</Text>
                <View style={styles.steps}>
                  {sheet.steps.map((label, index) => {
                    const Icon = STEP_ICONS[index] ?? Wine;
                    return (
                      <View key={label} style={styles.step}>
                        <View style={styles.stepTile}>
                          <Icon size={32} color={STEP_ICON_COLORS[index] ?? colors.text.primary} weight="regular" />
                        </View>
                        <Text style={styles.stepLabel}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.terms}>
                <Text style={styles.termsTitle}>{sheet.termsTitle}</Text>
                <Text style={styles.termsText}>
                  {sheet.terms.map((line) => `· ${line}`).join("\n")}
                </Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Значки шагов (узлы 5012:5714, 5012:5723, 5012:5736): календарь с
 * галочкой, QR-код, бокал. */
const STEP_ICONS: readonly React.ComponentType<IconProps>[] = [CalendarCheck, QrCode, Wine];
/** Первые два — #2A2C35, бокал — #1B1B1B, как в макете. */
const STEP_ICON_COLORS: readonly string[] = [
  colors.brand2.sheetStepIcon,
  colors.brand2.sheetStepIcon,
  colors.text.primary,
];

/** Крестик стоит там же, где кнопки поверх шапки страницы — 26 от верха, но
 * тут над ним ещё ручка, поэтому чуть ниже. */
const CLOSE_TOP = 16;
/** Низ листа в макете — 27 (node 5012:5691, паддинг B27). */
const SHEET_BOTTOM_PADDING = 27;
/** Верх содержимого героя. В макете — 22 (контейнер 126 при герое 170, по 22
 * сверху и снизу), но у нас над плашкой промо стоит крестик (16 + 40), и плашка
 * начинается под ним с просветом 8, чтобы на 360 dp они не пересекались. */
const HERO_CONTENT_TOP = CLOSE_TOP + brandPageLayout.heroControlSize + spacing.sm;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: colors.overlay.brandSheetScrim,
  },
  sheet: {
    backgroundColor: colors.brand2.sheet,
    borderTopLeftRadius: oceanPageLayout.welcomeSheetRadius,
    borderTopRightRadius: oceanPageLayout.welcomeSheetRadius,
    overflow: "hidden",
  },
  hero: {
    minHeight: oceanPageLayout.welcomeSheetHeroHeight,
    borderRadius: oceanPageLayout.welcomeSheetRadius,
    overflow: "hidden",
    backgroundColor: colors.brand2.navy,
    justifyContent: "flex-end",
  },
  heroContent: {
    paddingHorizontal: oceanPageLayout.heroContentPaddingHorizontal,
    paddingTop: HERO_CONTENT_TOP,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  handle: {
    position: "absolute",
    top: oceanPageLayout.welcomeSheetHandleTop,
    alignSelf: "center",
    width: oceanPageLayout.welcomeSheetHandleWidth,
    height: oceanPageLayout.welcomeSheetHandleHeight,
    borderRadius: oceanPageLayout.welcomeSheetHandleHeight,
    backgroundColor: colors.background.surface,
  },
  close: {
    position: "absolute",
    right: spacing.lg,
  },
  promoBadge: {
    alignSelf: "flex-start",
    height: oceanPageLayout.welcomeSheetPromoHeight,
    borderRadius: oceanPageLayout.welcomeSheetPromoRadius,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brand2.promoBadgeSurface,
  },
  promoBadgeLabel: {
    ...typography.brandPromoBadge,
    color: colors.brand2.gold,
    flexShrink: 1,
  },
  card: {
    minHeight: oceanPageLayout.welcomeSheetCardMinHeight,
    borderRadius: oceanPageLayout.welcomeSheetCardRadius,
    borderWidth: 1,
    borderColor: colors.brand2.gold,
    backgroundColor: colors.brand2.welcomeCardSurface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cardIcon: {
    width: oceanPageLayout.welcomeSheetCardIconCircle,
    height: oceanPageLayout.welcomeSheetCardIconCircle,
    borderRadius: oceanPageLayout.welcomeSheetCardIconCircle / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand2.gold,
  },
  cardText: {
    flexShrink: 1,
    flexGrow: 1,
    gap: 2,
  },
  cardTitle: {
    ...typography.brandSectionTitle,
    color: colors.background.surface,
  },
  cardSubtitle: {
    ...typography.brandPromoAction,
    color: colors.brand2.onNavy,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xxl,
  },
  block: {
    gap: spacing.md,
  },
  blockTitle: {
    ...typography.titleMd,
    color: colors.brand2.sheetSectionTitle,
  },
  checkList: {
    gap: 6,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
  },
  checkCircle: {
    width: oceanPageLayout.welcomeSheetCheckSize,
    height: oceanPageLayout.welcomeSheetCheckSize,
    borderRadius: oceanPageLayout.welcomeSheetCheckSize / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand2.gold,
  },
  checkLabel: {
    ...typography.body,
    color: colors.brand2.navy,
    flexShrink: 1,
  },
  steps: {
    flexDirection: "row",
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
  },
  stepTile: {
    width: oceanPageLayout.welcomeSheetStepTile,
    height: oceanPageLayout.welcomeSheetStepTile,
    borderRadius: oceanPageLayout.welcomeSheetStepTileRadius,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.surface,
  },
  stepLabel: {
    ...typography.brandSheetStepLabel,
    color: colors.brand2.navy,
    textAlign: "center",
  },
  terms: {
    borderRadius: oceanPageLayout.welcomeSheetTermsRadius,
    backgroundColor: colors.brand2.accentSurface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  termsTitle: {
    ...typography.titleMd,
    color: colors.brand2.navy,
  },
  termsText: {
    ...typography.body,
    color: colors.brand2.muted,
  },
});
