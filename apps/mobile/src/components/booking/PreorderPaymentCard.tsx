import { RepositoryError } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { formatCountdown, remainingMs } from "../../lib/kaspi-payment";
import type { KaspiPaymentFlow } from "../../hooks/useKaspiPayment";
import { formatMoneyMinor } from "../../lib/format";
import { PrimaryButton } from "../PrimaryButton";
import { BookingCard } from "./BookingCard";
import { KaspiPayButton } from "./KaspiPayButton";

const t = getDictionary();

/**
 * Блок «Оплата предзаказа» на экране брони.
 *
 * Четыре состояния, и ни одно не смешивается с другим:
 *
 *   idle      — счёта нет: приглашение и красная кнопка Kaspi;
 *   awaiting  — ссылка жива: отсчёт мм:сс, «открыть снова», «я оплатил»;
 *   settling  — деньги ушли, сервер дожимает списание: кнопок оплаты нет;
 *   paid      — оплачено: сумма и всё, КНОПКИ ОПЛАТЫ БОЛЬШЕ НЕТ;
 *   dead      — ссылка истекла или платёж не прошёл: объяснение + «новая
 *               ссылка» (это отдельный счёт с НОВЫМ ключом идемпотентности).
 *
 * Компонент не ходит в сеть и не знает про react-query: всё состояние
 * приезжает готовым из `useKaspiPaymentFlow`. Так его можно отрендерить в
 * тесте в любой фазе, не поднимая ни одного мока репозитория.
 */
export function PreorderPaymentCard({
  flow,
  onOpenLink,
  onCheck,
  /** Сумма предзаказа, пока счёта ещё нет: тийины, как их посчитал сервер. */
  fallbackAmountMinor,
  /** Ссылка есть, но открыть её не удалось (нет браузера, нет Kaspi). */
  openFailed,
}: {
  flow: KaspiPaymentFlow;
  onOpenLink: () => void;
  onCheck: () => void;
  fallbackAmountMinor: number | null;
  openFailed: boolean;
}) {
  const { phase, payment, creating, error, now } = flow;
  const amountMinor = payment?.amountMinor ?? fallbackAmountMinor;
  const amount = amountMinor === null ? null : formatMoneyMinor(amountMinor);
  const left = remainingMs(payment?.expiresAt ?? null, now);
  const failure = createFailureMessage(error);

  return (
    <BookingCard title={t.booking.paymentSectionTitle}>
      {phase === "paid" ? (
        <>
          <Text style={styles.strong} accessibilityRole="header">
            {t.booking.paymentPaidTitle}
          </Text>
          {amount ? <Text style={styles.hint}>{t.booking.paymentPaidHint(amount)}</Text> : null}
        </>
      ) : null}

      {phase === "settling" ? (
        <Text style={styles.strong}>{t.booking.paymentSettlingTitle}</Text>
      ) : null}

      {phase === "awaiting" ? (
        <>
          <Text style={styles.strong}>{t.booking.paymentAwaitingTitle}</Text>
          {/* Отсчёт рисуется ТОЛЬКО когда сервер прислал дедлайн. Свой срок мы
              не выдумываем: ссылка Kaspi живёт минуты, и придуманный таймер
              обещал бы гостю время, которого у него нет. */}
          {left !== null ? (
            <Text style={styles.countdown} accessibilityRole="text">
              {t.booking.paymentCountdown(formatCountdown(left))}
            </Text>
          ) : null}
          <PrimaryButton
            label={t.booking.paymentOpenAgain}
            size="lg"
            onPress={onOpenLink}
            accessibilityHint={t.booking.paymentOpensExternally}
          />
          <PrimaryButton
            label={t.booking.paymentCheckAgain}
            variant="secondary"
            size="lg"
            onPress={onCheck}
          />
        </>
      ) : null}

      {phase === "dead" ? (
        <>
          <Text style={styles.strong}>{t.booking.paymentDeadTitle}</Text>
          <Text style={styles.hint}>{t.booking.paymentDeadHint}</Text>
          <KaspiPayButton
            label={t.booking.paymentRenew}
            busy={creating}
            onPress={flow.renew}
            accessibilityHint={t.booking.paymentOpensExternally}
          />
        </>
      ) : null}

      {phase === "idle" ? (
        <>
          <Text style={styles.hint}>{t.booking.paymentIntro}</Text>
          <KaspiPayButton
            label={
              amount
                ? t.booking.paymentPayWithKaspiAmount(amount)
                : t.booking.paymentPayWithKaspi
            }
            busy={creating}
            onPress={flow.pay}
            accessibilityHint={t.booking.paymentOpensExternally}
          />
        </>
      ) : null}

      {failure ? (
        <Text style={styles.error} accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
      {openFailed ? (
        <Text style={styles.error} accessibilityRole="alert">
          {t.booking.paymentErrorCannotOpen}
        </Text>
      ) : null}
    </BookingCard>
  );
}

/**
 * Отказ создания счёта человеческими словами.
 *
 * Выбор — ТОЛЬКО по HTTP-статусу: `error` от сервера английский и написан для
 * разработчика («payments are not enabled for this restaurant»), показывать
 * его гостю нельзя. 409 приходит в двух случаях сразу — сервер нашёл живой
 * платёж, или наш собственный сторож не выпустил второй запрос при двойном
 * нажатии; в обоих гостю говорится одно и то же и ничего не ломается.
 */
export function createFailureMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof RepositoryError) {
    if (error.isOffline) return t.booking.paymentErrorOffline;
    if (error.status === 409) return t.booking.paymentErrorAlreadyActive;
    if (error.status === 422) return t.booking.paymentErrorUnavailable;
  }
  return t.booking.paymentErrorServer;
}

const styles = StyleSheet.create({
  strong: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  hint: {
    ...typography.body,
    color: colors.text.muted,
  },
  countdown: {
    ...typography.body,
    color: colors.text.primary,
  },
  error: {
    ...typography.caption,
    color: colors.brand.primary,
    marginTop: spacing.xs,
  },
});
