import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useEffect, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../../lib/locale";
import { useSheetAnimation } from "../../lib/sheet-animation";
import { X } from "../icons";
import { WheelPicker, type WheelOption } from "../search/WheelPicker";

/**
 * ОДНА шторка на дату и на число гостей — макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 3447:13024: заголовок «Дата и гости» с крестиком, два колеса рядом
 * («Когда» и «Гости») и одна кнопка «Показать заведения» внизу.
 *
 * Почему отдельный компонент, а не `WheelSheet`: у той шторки ОДНО колесо и
 * своя кнопка «Готово», и она стоит в фильтрах каталога (`AvailabilityWheels`,
 * макеты 918:12317 и 918:12428), где дата и гости действительно раскрываются
 * по очереди. На главной макет рисует их вместе, и человек, нажавший «2
 * гостя», должен видеть в той же шторке и день — иначе он подтверждает
 * половину подбора, а вторая молча берётся по умолчанию.
 *
 * Выбор ЧЕРНОВОЙ: колёса крутят локальное состояние, и наверх уходит ПАРА и
 * только по кнопке. Крестик и тап по затемнению закрывают шторку, ничего не
 * применив.
 */
export function PartySheet({
  visible,
  dateOptions,
  guestOptions,
  dateValue,
  guestsValue,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  dateOptions: WheelOption[];
  guestOptions: WheelOption[];
  /** Что применено сейчас — колёса открываются на этих значениях. */
  dateValue: string;
  guestsValue: string;
  /** Подтверждение. Всегда пара, никогда половина. */
  onSubmit: (party: { date: string; guests: string }) => void;
  onClose: () => void;
}) {
  const { dictionary: t } = useLocale();
  const insets = useSafeAreaInsets();
  const { mounted, progress, translateY } = useSheetAnimation(visible);
  const [date, setDate] = useState(dateValue);
  const [guests, setGuests] = useState(guestsValue);

  // Открыли заново — колёса показывают то, что применено сейчас, а не остаток
  // прошлого, неподтверждённого выбора.
  useEffect(() => {
    if (!visible) return;
    setDate(dateValue);
    setGuests(guestsValue);
  }, [visible, dateValue, guestsValue]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} accessibilityViewIsModal>
          <View style={styles.body}>
            <View style={styles.header}>
              <Text style={styles.title}>{t.explore.partySheetTitle}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.search.availabilityClose}
                hitSlop={hitSlop.minTouchTarget / 4}
                onPress={onClose}
              >
                <X size={24} color={colors.text.primary} weight="bold" />
              </Pressable>
            </View>

            {/* Две колонки в ряд, каждая на половину ширины (node 3447:13051):
                просвета между ними в макете нет — колёса делят строку пополам. */}
            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>{t.explore.partyDateColumn}</Text>
                <WheelPicker
                  options={dateOptions}
                  value={date}
                  onChange={setDate}
                  accessibilityLabel={t.explore.partyDateColumn}
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>{t.explore.partyGuestsColumn}</Text>
                <WheelPicker
                  options={guestOptions}
                  value={guests}
                  onChange={setGuests}
                  accessibilityLabel={t.explore.partyGuestsColumn}
                />
              </View>
            </View>
          </View>

          {/* Кнопка лежит на СВОЁЙ белой полосе с тенью вверх (node 3447:13036),
              а не внутри тела шторки: в макете она отделена от колёс. */}
          <View
            style={[
              styles.footer,
              // 34 в макете — это домашняя полоска iPhone. На устройстве без
              // неё столько пустоты снизу неоткуда взять, поэтому нижнее поле
              // не меньше обычного 16.
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => onSubmit({ date, guests })}
              style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
            >
              <Text style={styles.submitLabel}>{t.explore.partySubmit}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: colors.overlay.dialogScrim,
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
    flexShrink: 1,
  },
  columns: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  columnLabel: {
    ...typography.columnLabel,
    color: colors.text.primary,
    textAlign: "center",
  },
  footer: {
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    // Тень ровно из макета (node 3447:13036): `0px -8px 16px rgba(0,0,0,0.08)`.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    // У Android нет параметров тени — только elevation (тот же приём, что у
    // липкого футера в DetailBlocks и у плашки навигации).
    elevation: 8,
  },
  submit: {
    height: controlHeight.pill,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand.primary,
  },
  submitLabel: {
    ...typography.labelSemiBold,
    color: colors.text.onBrand,
  },
  pressed: {
    opacity: 0.8,
  },
});
