import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Переключатель «Активные / История» на экране броней — СЕГМЕНТИРОВАННАЯ
 * ДОРОЖКА: серая капсула во всю ширину, внутри две половины, у выбранной
 * белая заливка (Figma 3z0f6dgev4HMwBAHPjTjPo, node 3053:10074 → 3053:10075
 * и 3053:10077).
 *
 * ЭТО ОСОЗНАННЫЙ РАЗВОРОТ (правка владельца 2026-08-28, «возвращаем табы»).
 * Промежуточная редакция макета рисовала здесь ряд чипов-капсул по ширине
 * подписи с бордовой заливкой у выбранного — этого в узле 3053:10074 больше
 * нет. Чипы с бордовой заливкой остаются на «Избранном», но там свой
 * компонент (`FilterChip` с `selectedTone="brand"`), а не этот, — трогать его
 * не нужно.
 *
 * ПО МАКЕТУ. Дорожка `background/subtle` (#F8F8F8), скругление-капсула,
 * внутреннее поле 2 и такой же просвет между половинами; каждая половина
 * тянется поровну (`flex: 1`), поля 12 по бокам и 10 сверху/снизу — это и
 * даёт высоту 40, а вся дорожка выходит 44. Выбранная половина белая,
 * невыбранная — прозрачная (сквозь неё видна дорожка).
 *
 * ПОДПИСЬ ОДИНАКОВАЯ У ОБЕИХ ПОЛОВИН: Medium 14/20, цвет `text.primary`
 * (#1B1B1B). В макете выбранную отличает ТОЛЬКО белая заливка — ни цвет, ни
 * начертание текста не меняются. Поэтому активную вкладку обязательно
 * помечает `aria-selected`: на глаз-то заливка видна, а скринридеру белый
 * фон не расскажет ничего.
 *
 * Это НЕ `SegmentedTabs`: тот рисует подчёркнутый ряд вкладок на карточке
 * заведения и в галерее фотографий. И это НЕ `FilterChip`: тот — фильтр со
 * своей семантикой (`button` + `selected`), а здесь вкладки, которым нужна
 * роль `tab`/`tablist`, иначе скринридер прочитает переключение раздела как
 * включение фильтра.
 */

/**
 * Внутреннее поле дорожки и просвет между половинами — по 2 (node 3053:10074:
 * `p-[2px]`, `gap-[2px]`; половины 168.5 при дорожке 343). В 4pt-шкале
 * `spacing` такого шага нет, поэтому число живёт здесь.
 */
const TRACK_INSET = 2;

export function PillTabs({
  labels,
  activeIndex,
  onChange,
}: {
  labels: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {labels.map((label, index) => {
        const active = index === activeIndex;
        return (
          <Pressable
            key={label}
            onPress={() => onChange(index)}
            accessibilityRole="tab"
            // `aria-selected`, а не `accessibilityState`: React Native
            // отображает aria-* в нативное состояние сам, а react-native-web
            // (на нём крутятся тесты) accessibilityState в DOM не выносит —
            // так активная вкладка видна и голосовому доступу, и тесту.
            aria-selected={active}
            accessibilityLabel={label}
            // Зона касания не расширяется: половина и так 40 в высоту при
            // ширине в пол-экрана, а промахнуться мимо неё некуда — соседняя
            // половина вплотную.
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: TRACK_INSET,
    padding: TRACK_INSET,
    borderRadius: radius.pill,
    backgroundColor: colors.background.subtle,
  },
  tab: {
    // Половины делят дорожку поровну и тянутся во всю её ширину — в отличие
    // от чипа, который занимал ровно ширину подписи.
    flex: 1,
    minWidth: 0,
    height: controlHeight.chip,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.background.surface,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
});
