import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { IconProps } from "../icons";

/**
 * Общая раскладка «карточки контента» — экранов афиши (`app/event/[id].tsx`)
 * и акции (`app/promotion/[id].tsx`).
 *
 * Макет 986:8940: серый фон экрана работает разделителем, содержимое лежит
 * отдельными белыми блоками с просветом 8 между ними, а под последним блоком
 * идёт белый «пол», чтобы оттягивание вниз не показывало серое.
 *
 * Раньше эти стили жили копией в каждом из двух экранов и уже начали
 * расходиться (у акции блоки были сплошным белым листом). Один источник —
 * чтобы правка макета не требовала помнить про второй файл.
 */

/** Высота липкого футера с кнопкой (48 кнопка + 12 отступы сверху и снизу)
 * плюс воздух, чтобы последняя строка не липла к ней вплотную. */
export const DETAIL_FOOTER_CLEARANCE = controlHeight.pill + spacing.md * 2 + spacing.xxl;

/**
 * Строка «иконка + текст» внутри блока: дата, адрес, телефон.
 * Вторая строка (`secondary`) рисуется только когда она есть.
 */
export function DetailInfoRow({
  icon: Icon,
  primary,
  secondary,
}: {
  icon: React.ComponentType<IconProps>;
  primary: string;
  secondary?: string;
}) {
  return (
    <View style={detailStyles.contactRow}>
      <Icon size={24} color={colors.text.primary} weight="regular" />
      {/* flex:1 — длинный адрес переносится, а не уезжает за экран 360pt. */}
      <View style={detailStyles.contactText}>
        <Text style={detailStyles.contactPrimary}>{primary}</Text>
        {secondary ? <Text style={detailStyles.contactSecondary}>{secondary}</Text> : null}
      </View>
    </View>
  );
}

export const detailStyles = StyleSheet.create({
  root: {
    flex: 1,
    // Серый фон — разделитель между блоками (макет 986:8940): фотография с
    // описанием, «об афише»/«об акции» и контакты лежат отдельными белыми
    // полосами.
    backgroundColor: colors.background.screen,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: spacing.sm,
  },
  headerRightGroup: {
    flexDirection: "row",
  },
  // Белый «пол» ПОД содержимым: он виден только там, где содержимое кончилось —
  // при оттягивании снизу. Сам список блоков красит contentContainer, иначе
  // белое залило бы и просветы между блоками, и разделители исчезли бы.
  //
  // Отрицательный отступ съедает просвет, который контейнер ставит между всеми
  // блоками: последний блок должен переходить в белый «пол» без серой полоски
  // над кнопкой (правка владельца от 20.08).
  bottomFloor: {
    marginTop: -spacing.sm,
    height: DETAIL_FOOTER_CLEARANCE,
    backgroundColor: colors.background.surface,
  },
  scrollFloor: {
    backgroundColor: colors.background.surface,
  },
  scrollContent: {
    backgroundColor: colors.background.screen,
    gap: spacing.sm,
  },
  summaryBlock: {
    backgroundColor: colors.background.surface,
  },
  coverContainer: {
    // Те же 12 по краям, что и на карточке заведения: гость ходит между этими
    // экранами, и фотография не должна стоять на них по-разному.
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.surface,
  },
  // Фотография, название, подпись и чипы — ОДИН блок: это ответ на вопрос
  // «что это», и просвет посреди него делил бы ответ надвое.
  summary: {
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
  },
  favoriteFailed: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  section: {
    backgroundColor: colors.background.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  body: {
    ...typography.body,
    color: colors.text.primary,
  },
  socialRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  socialIcon: {
    width: controlHeight.contactIcon,
    height: controlHeight.contactIcon,
    borderRadius: radius.pill,
    backgroundColor: colors.background.socialIcon,
    alignItems: "center",
    justifyContent: "center",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  contactText: {
    flex: 1,
  },
  contactPrimary: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  contactSecondary: {
    ...typography.caption,
    color: colors.text.muted,
  },
  footerSafeArea: {
    backgroundColor: colors.background.surface,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 16,
    elevation: 8,
  },
  footer: {
    padding: spacing.md,
  },
});
