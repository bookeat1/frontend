import { appUpdateDialog, colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { UpdatePrompt } from "../lib/app-update";
import { PrimaryButton } from "./PrimaryButton";

/**
 * «Доступно обновление BookEat» — окно поверх приложения.
 * Макет: Figma QovvuAoI9YxsLMwWkfgKN8, node 3623:9053.
 *
 * ЧТО СНЯТО С МАКЕТА. Карточка: скругление 16, поля 16, заголовок по центру
 * (Noto Sans SemiBold 16, `#1B1B1B`), текст по центру (Regular 14, тот же
 * цвет), просвет заголовок↔текст 6, текст↔кнопки 16. Главная кнопка — красная
 * (`#B33036`) пилюля во всю ширину, поля 16/12, подпись 16/20 белым.
 *
 * ЧТО НЕ СНЯТО С МАКЕТА (решение владельца 02.09.2026 — «делать по макету,
 * включая кнопку „Позже“»; самой кнопки в прочитанном узле 3623:9053 НЕТ):
 *
 *  - ВИД кнопки «Позже». Взят существующий `PrimaryButton variant="secondary"`
 *    — серая пилюля с тёмной подписью, та же пара, что в «Отменить бронь?».
 *    Вторую кнопку с новым оформлением здесь не заводим: пока дизайнер не
 *    показал свою, копия уже принятой в приложении пары честнее выдуманной.
 *  - Просвет между кнопками (8) — тоже из «Отменить бронь?».
 *  - Подложка, её цвет и боковые поля карточки: узел 3623:9053 — это САМА
 *    КАРТОЧКА (`size-full` внутри родителя), а родительский кадр прочитать не
 *    удалось (Figma отвечает 429 по этому файлу с 02.09.2026).
 *
 * ДВА РЕЖИМА, и разница между ними — не оформление, а наличие выхода:
 *
 *  - `blocking: false` (мягкая просьба и «перезапустить») — есть кнопка
 *    «Позже», и то же самое делают тап по подложке и аппаратная «назад»;
 *  - `blocking: true` (`action: "required"`) — кнопки «Позже» НЕТ, и не
 *    закрывается ничем.
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
  laterLabel,
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
  /** Подпись второй кнопки. Показывается только у закрываемого окна. */
  laterLabel: string;
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
        {/* Подложка — только тап мимо карточки, для зрячего гостя. Из дерева
            доступности убрана В ОБОИХ режимах: выход из мягкого окна теперь
            несёт настоящая кнопка «Позже», и безымянная цель во весь экран
            рядом с ней была бы лишним элементом, а не вторым выходом. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          disabled={blocking}
          importantForAccessibility="no"
          accessibilityElementsHidden
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

          <View style={styles.actions}>
            <PrimaryButton
              label={prompt.kind === "restart" ? restartLabel : updateLabel}
              labelSize="lg"
              onPress={onAct}
              disabled={acting}
            />
            {/* «Позже» существует ровно там, где у гостя есть выбор. В жёстком
                режиме её нет не для красоты: окно, которое нельзя закрыть, не
                должно показывать кнопку, притворяющуюся выходом. */}
            {blocking ? null : (
              <PrimaryButton
                label={laterLabel}
                variant="secondary"
                labelSize="lg"
                onPress={onDismiss}
                disabled={acting}
              />
            )}
          </View>
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
  actions: {
    // Просвет между кнопками НЕ из макета (второй кнопки в узле нет) — тот же
    // 8, что у пары кнопок в «Отменить бронь?».
    gap: spacing.sm,
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
