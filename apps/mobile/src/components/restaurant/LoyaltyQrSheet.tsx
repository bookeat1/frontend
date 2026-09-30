import { borderWidth, colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useMemo } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSheetAnimation } from "../../lib/sheet-animation";
import { DecorativeQrPattern } from "./DecorativeQrPattern";

const t = getDictionary();

/**
 * Шторка «QR-код лояльности» — открывается новой кнопкой в шапке карточки
 * заведения (`VenueHero`, значок между «назад» и сердечком, Figma node
 * 5386:6855 / 5455:6726). Содержимое шторки — узел 5455:6737.
 *
 * ЭТО ВИЗУАЛЬНАЯ ЗАГЛУШКА, НЕ РАБОЧАЯ ФУНКЦИЯ. Зафиксировано с владельцем
 * заранее (задача на добавление кнопки, 2026-09-29): у бэкенда нет ручки,
 * отдающей персональный код лояльности гостя, и программы лояльности вообще
 * не существует (проверено grep'ом backend и frontend — ничего). Поэтому:
 *   - сам QR-код декоративный (`DecorativeQrPattern` — псевдослучайный узор,
 *     не кодирует ничего, см. комментарий там);
 *   - код цифрами под ним — случайные шесть цифр, посчитанные на клиенте, а
 *     не ответ сервера.
 * Когда бэкенд получит эндпоинт персонального кода лояльности (например
 * `GET /users/me/loyalty-code`, отдающий строку кода) — эту шторку нужно
 * подключить к нему: заменить `placeholderLoyaltyCode()` на код из ответа и
 * передать его же в `DecorativeQrPattern`/настоящий генератор QR, ничего
 * больше в вёрстке менять не придётся.
 *
 * МЕХАНИКА открытия/закрытия — та же, что у `ConfirmSheet`: один прогресс
 * (`useSheetAnimation`) двигает и панель, и затемнение; тап по фону и
 * системная «назад» закрывают, как и остальные шторки приложения.
 *
 * РАЗМЕЩЕНИЕ отличается от `ConfirmSheet`/`WheelSheet`. В макете (узел
 * 5455:6737) это не полноширинная штора от края до края снизу экрана, а
 * заметно более узкая карточка со скруглением на ВСЕХ четырёх углах,
 * центрированная по обеим осям и не достающая до низа экрана — визуально
 * ближе к диалогу, чем к остальным шести шторкам. Поэтому корень здесь
 * центрирует панель вместо `justify-content: flex-end` остальных шторок.
 */
export function LoyaltyQrSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { mounted, progress, translateY } = useSheetAnimation(visible);

  // Код-заглушка пересчитывается при каждом открытии шторки (компонент
  // размонтируется на закрытии, см. `mounted` ниже) — держит в силе подпись
  // «обновляется каждый визит», хотя реального обновления по визиту здесь,
  // конечно, нет: это просто новый случайный набор цифр.
  const code = useMemo(() => (mounted ? placeholderLoyaltyCode() : ""), [mounted]);

  if (!mounted) return null;

  const sheet = t.restaurant.loyaltyQr;

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}
          testID="loyalty-qr-backdrop"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>

        <Animated.View
          style={[styles.card, { transform: [{ translateY }] }]}
          accessibilityViewIsModal
          testID="loyalty-qr-sheet"
        >
          <Text style={styles.title}>{sheet.title}</Text>

          <View style={styles.qrFrame}>
            <DecorativeQrPattern size={QR_PATTERN_SIZE} />
          </View>

          <Text style={styles.code}>{code}</Text>

          <View style={styles.instructionBlock}>
            <Text style={styles.instruction}>{sheet.instruction}</Text>
            <Text style={styles.note}>{sheet.note}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Шесть случайных цифр с пробелом посередине — тот же формат, что в
 * макете («234 343»). ЗАГЛУШКА: см. комментарий компонента выше. */
function placeholderLoyaltyCode(): string {
  const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** Сторона рамки QR (узел 5455:6737 не даёт точного размера в px — карточка
 * там не полноширинная, а описана только визуально; число подобрано так,
 * чтобы карточка целиком помещалась на экран 360 dp с отступами). */
const QR_FRAME_SIZE = 220;
/** Внутреннее поле рамки — стандартный шаг отступов приложения. */
const QR_FRAME_PADDING = spacing.md;
const QR_PATTERN_SIZE = QR_FRAME_SIZE - QR_FRAME_PADDING * 2;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    backgroundColor: colors.overlay.dialogScrim,
  },
  card: {
    marginHorizontal: spacing.huge,
    backgroundColor: colors.background.surface,
    borderRadius: radius.dialog,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
    gap: spacing.lg,
  },
  title: {
    ...typography.titleLg,
    color: colors.brand.primary,
  },
  qrFrame: {
    width: QR_FRAME_SIZE,
    height: QR_FRAME_SIZE,
    borderRadius: radius.card,
    borderWidth: borderWidth.loyaltyQrFrame,
    borderColor: colors.brand.primary,
    padding: QR_FRAME_PADDING,
    alignItems: "center",
    justifyContent: "center",
  },
  code: {
    ...typography.titleXl,
    color: colors.text.strong,
  },
  instructionBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  instruction: {
    ...typography.titleMd,
    color: colors.text.primary,
    textAlign: "center",
  },
  note: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: "center",
  },
});
