import { appUpdateDialog, colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { UpdatePrompt } from "../lib/app-update";
import { PrimaryButton } from "./PrimaryButton";

/**
 * «Доступно обновление BookEat» — окно поверх приложения.
 * Макет: Figma QovvuAoI9YxsLMwWkfgKN8, node 3623:9053.
 *
 * ЧТО В МАКЕТЕ И ЧЕГО В НЁМ НЕТ. Нарисована карточка: заголовок по центру
 * (16 SemiBold), текст по центру (14 Regular), под ними ОДНА кнопка во всю
 * ширину — красная пилюля «Обновить». Ни крестика, ни второй кнопки
 * («Позже», «Не сейчас») в узле нет, поэтому их здесь нет тоже: закрыть
 * мягкое окно можно тапом мимо карточки и аппаратной «назад».
 *
 * ЧТО НЕ СВЕРЕНО. Узел 3623:9053 — это САМА КАРТОЧКА (`size-full` внутри
 * родителя), поэтому ширина карточки, боковые поля и цвет подложки заданы
 * кадром выше, а его прочитать не удалось (Figma отвечала 429 на все запросы
 * 02.09.2026). Подложка и поля взяты у существующего диалога подтверждения
 * («Отменить бронь?»), это единственные значения в файле не из макета.
 *
 * ДВА РЕЖИМА, и разница между ними — не оформление, а наличие выхода:
 *
 *  - `blocking: false` (мягкая просьба и «перезапустить») — закрывается тапом
 *    по подложке и аппаратной «назад»;
 *  - `blocking: true` (`action: "required"`) — не закрывается ничем.
 *    Единственное действие — уйти в магазин. Именно поэтому «магазин не
 *    открылся» показывается прямо в окне: иначе гость остаётся перед
 *    кнопкой, которая молча ничего не делает, и без единой подсказки.
 */
export function AppUpdateDialog({
  prompt,
  acting,
  actionError,
  onAct,
  onDismiss,
  updateLabel,
  restartLabel,
  closeLabel,
}: {
  /** `null` — окна нет. Компонент рисует `null`, а не пустой `Modal`. */
  prompt: UpdatePrompt | null;
  acting: boolean;
  /** Уже переведённое сообщение о неудаче действия, или `null`. */
  actionError: string | null;
  onAct: () => void;
  onDismiss: () => void;
  updateLabel: string;
  restartLabel: string;
  /** Подпись НЕВИДИМОЙ цели «закрыть» — подложки. Нужна только скринридеру:
   * в макете кнопки «Позже» нет, а закрывать мягкое окно чем-то надо. */
  closeLabel: string;
}) {
  if (!prompt) return null;

  const blocking = prompt.blocking;
  // Аппаратная «назад» на Android и тап по подложке значат одно и то же —
  // «не сейчас». В жёстком режиме они не значат ничего.
  const dismiss = () => {
    if (!blocking) onDismiss();
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        {/* Подложка. Для зрячего гостя это просто «тапнуть мимо», для
            скринридера — ЕДИНСТВЕННЫЙ способ закрыть мягкое окно: кнопки
            «Позже» в макете нет, а безымянная цель во весь экран была бы
            хуже, чем названная. Поэтому в мягком режиме она объявляется
            кнопкой «Закрыть», а в жёстком не кликается и скрыта совсем —
            там закрывать нечем и обещать нечего. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          disabled={blocking}
          accessible={!blocking}
          accessibilityRole={blocking ? undefined : "button"}
          accessibilityLabel={blocking ? undefined : closeLabel}
          importantForAccessibility={blocking ? "no" : "yes"}
          accessibilityElementsHidden={blocking}
        />
        {/* accessibilityViewIsModal запирает VoiceOver внутри окна — для
            жёсткого режима это не украшение, а само его содержание. */}
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.text}>
            <Text style={styles.title} accessibilityRole="header">
              {prompt.title}
            </Text>
            <Text style={styles.message}>{prompt.message}</Text>
          </View>

          {actionError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {actionError}
            </Text>
          ) : null}

          <PrimaryButton
            label={prompt.kind === "restart" ? restartLabel : updateLabel}
            labelSize="lg"
            onPress={onAct}
            disabled={acting}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Подложка и боковые поля — НЕ из макета (родительский кадр не прочитан),
    // взяты у диалога подтверждения, чтобы два окна приложения не разъезжались.
    backgroundColor: colors.overlay.dialogScrim,
    justifyContent: "center",
    padding: spacing.xxl,
  },
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: appUpdateDialog.cardRadius,
    padding: appUpdateDialog.cardPadding,
    gap: appUpdateDialog.blockGap,
  },
  text: {
    gap: appUpdateDialog.textGap,
  },
  title: {
    ...typography.appUpdateTitle,
    color: colors.text.primary,
    textAlign: "center",
  },
  message: {
    ...typography.appUpdateMessage,
    color: colors.text.primary,
    textAlign: "center",
  },
  error: {
    ...typography.appUpdateMessage,
    // Не `negativeText`: тот подобран под цветную подложку пилюли и на белом
    // читается плохо (тот же выбор, что в CancelBookingDialog).
    color: colors.status.negativeTextOnSurface,
    textAlign: "center",
  },
});
