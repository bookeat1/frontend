"use client";

import { Button } from "@web/components/ui/Button";
import { formatCountdown, remainingMs } from "@web/lib/kaspi-payment";
import type { KaspiPaymentFlow } from "@web/lib/use-kaspi-payment";
import { formatMoneyMinor } from "@web/lib/format";
import { useLocale } from "@web/lib/locale";
import { RepositoryError } from "@bookeat/api/client";

/**
 * Блок «Оплата предзаказа» на билете (`/bookings/[id]`) — веб-версия
 * `apps/mobile/src/components/booking/PreorderPaymentCard.tsx`. Первый
 * функциональный проход для сквозной проверки TipTopPay на тестовом
 * заведении (Abay), НЕСВЕРЕНО с Figma — узла под эту карточку в макете сайта
 * ещё нет.
 *
 * Те же пять состояний, что на мобилке, и то же правило: кнопки оплаты нет
 * ни в `settling`, ни в `paid` — это чек, а не приглашение заплатить ещё раз.
 */
export function PreorderPaymentCard({
  flow,
  fallbackAmountMinor,
}: {
  flow: KaspiPaymentFlow;
  /** Сумма предзаказа, пока счёта ещё нет — тийины, как посчитал сервер. */
  fallbackAmountMinor: number | null;
}) {
  const { t } = useLocale();
  const texts = t.web.bookingResult.payment;
  const { phase, payment, creating, error, now } = flow;
  const amountMinor = payment?.amountMinor ?? fallbackAmountMinor;
  const amount = amountMinor === null ? null : formatMoneyMinor(amountMinor);
  const left = remainingMs(payment?.expiresAt ?? null, now);
  const failure = createFailureMessage(error, texts);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-subtle p-4">
      <p className="text-bodyS font-semibold tracking-[0.2px] text-ink-tertiary">
        {texts.sectionTitle}
      </p>

      {phase === "paid" ? (
        <div role="status" className="flex flex-col gap-1">
          <p className="text-bodyM font-semibold text-ink">{texts.paidTitle}</p>
          {amount ? <p className="text-bodyS text-ink-secondary">{texts.paidHint(amount)}</p> : null}
        </div>
      ) : null}

      {phase === "settling" ? (
        <p role="status" className="text-bodyM font-semibold text-ink">
          {texts.settlingTitle}
        </p>
      ) : null}

      {phase === "awaiting" ? (
        <div className="flex flex-col gap-3">
          <p className="text-bodyM font-semibold text-ink">{texts.awaitingTitle}</p>
          {left !== null ? (
            <p role="status" className="text-bodyS text-ink-secondary">
              {texts.countdown(formatCountdown(left))}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="ticket"
              variant="outline"
              block
              disabled={!flow.openLink}
              onClick={() => {
                if (flow.openLink) window.location.assign(flow.openLink);
              }}
            >
              {texts.openAgain}
            </Button>
            <Button size="ticket" variant="secondary" block onClick={flow.check}>
              {texts.checkAgain}
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "dead" ? (
        <div className="flex flex-col gap-3">
          <p className="text-bodyM font-semibold text-ink">{texts.deadTitle}</p>
          <p className="text-bodyS text-ink-secondary">{texts.deadHint}</p>
          <Button size="ticket" block loading={creating} disabled={creating} onClick={flow.renew}>
            {texts.renew}
          </Button>
        </div>
      ) : null}

      {phase === "idle" ? (
        <div className="flex flex-col gap-3">
          <p className="text-bodyS text-ink-secondary">{texts.intro}</p>
          <Button size="ticket" block loading={creating} disabled={creating} onClick={flow.pay}>
            {amount ? texts.payWithKaspiAmount(amount) : texts.payWithKaspi}
          </Button>
        </div>
      ) : null}

      {failure ? (
        <p role="alert" className="text-bodyS text-danger-text">
          {failure}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Отказ создания счёта человеческими словами — тот же разбор по HTTP-статусу,
 * что на мобилке (`createFailureMessage`): серверный `error` английский и
 * написан для разработчика, показывать его гостю нельзя.
 */
function createFailureMessage(
  error: unknown,
  texts: { errorOffline: string; errorAlreadyActive: string; errorUnavailable: string; errorServer: string },
): string | null {
  if (!error) return null;
  if (error instanceof RepositoryError) {
    if (error.isOffline) return texts.errorOffline;
    if (error.status === 409) return texts.errorAlreadyActive;
    if (error.status === 422) return texts.errorUnavailable;
  }
  return texts.errorServer;
}
