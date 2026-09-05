"use client";

import { useId, useState, type ReactNode } from "react";
import type { Restaurant } from "@bookeat/api/client";

import { StateMessage } from "@web/components/state/AsyncBlock";
import { BottomBar } from "@web/components/ui/BottomBar";
import { Button } from "@web/components/ui/Button";
import { cx } from "@web/lib/cx";
import { RemoteImage } from "@web/components/ui/RemoteImage";
import type { SubmitFailure } from "@web/lib/booking-submit";
import { useLocale } from "@web/lib/locale";

/**
 * Сводка справа — узел 3525:14940 «Card / Summary»: радиус 20, паддинг 24,
 * просвет 18, ширину задаёт колонка (380).
 *
 * ЧТО ИЗ МАКЕТА ЗДЕСЬ НЕТ: строки «Зона» (зон у сервера нет), плашки
 * «Предзаказ» и кнопки «Перейти к предзаказу» — предзаказа на сайте нет, и
 * кнопка вела бы в никуда. Осталась одна кнопка — «Забронировать»
 * (по макету это «Забронировать без предзаказа», 3525:14973), и раз она
 * единственная, она главная: заливка, а не обводка.
 *
 * НИЖЕ `lg` (контракт `docs/responsive.md`, дыра № 10) карточка ведёт себя как
 * экран брони приложения (`apps/mobile/app/restaurant/[id]/book/index.tsx`):
 * кнопка отправки — в прибитой к низу полосе, причина отказа над ней, а
 * сама сводка (заведение, строки, сумма) свёрнута в раскрываемый блок и
 * стоит в потоке под формой. Кнопка при этом ОДНА в DOM на оба экрана —
 * `BottomBar desktop="inline"` возвращает её в карточку с `lg`.
 */
export interface SummaryRow {
  label: string;
  value: string | null;
}

export type SummaryAction =
  /** Сессии нет — ссылка на вход с возвратом сюда. */
  | { kind: "signIn"; href: string }
  /** Время не выбрано — кнопка выключена и говорит, чего ждёт. */
  | { kind: "pickTime" }
  /** Отправка. `blocked` — бронь уже есть, повтор запрещён. */
  | { kind: "submit"; submitting: boolean; blocked: boolean; onSubmit: () => void }
  /** Сессия ещё читается из хранилища — кнопка есть, но нажать нельзя. */
  | { kind: "waiting" };

export function BookingSummary({
  venue,
  rows,
  reschedule,
  failure,
  action,
}: {
  venue: Restaurant;
  rows: SummaryRow[];
  /** Режим переноса: другая подпись кнопки и подсказка вместо суммы. */
  reschedule: boolean;
  failure: SubmitFailure | null;
  action: SummaryAction;
}) {
  const { t } = useLocale();
  const texts = t.web.booking.summary;
  const titleId = useId();
  const bodyId = useId();
  /** Раскрыта ли сводка на узком экране. С `lg` состояние не читается:
   * тело всегда видно, переключатель спрятан. */
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-flow-summary-gap rounded-xl bg-canvas p-flow-summary-p shadow-aside"
    >
      <h2 id={titleId} className="sr-only">
        {texts.title}
      </h2>

      {/* Переключатель только ниже `lg`: заголовок «Ваша бронь» и стрелка.
          Настоящая кнопка — доступна с клавиатуры, диктор слышит состояние. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((current) => !current)}
        className="-m-1 flex items-center justify-between gap-3 rounded-md p-1 text-left text-flow-total text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
      >
        <span>{texts.title}</span>
        <Chevron up={expanded} />
      </button>

      <div
        id={bodyId}
        className={cx("flex-col gap-flow-summary-gap lg:flex", expanded ? "flex" : "hidden")}
      >
      {/* Узел 3525:14941: фото 64 радиуса 14, «фото → текст» через 14. */}
      <div className="flex items-center gap-3.5">
        <div className="relative h-flow-summary-photo w-flow-summary-photo shrink-0 overflow-hidden rounded-field bg-muted">
          <RemoteImage src={venue.coverPhoto?.uri} alt="" sizes="64px" />
        </div>
        <div className="flex min-w-0 flex-col gap-flow-venue-text-gap">
          <p className="truncate text-flow-summary-name text-ink">{venue.name}</p>
          {venue.address.trim() ? (
            <p className="truncate text-bodyS text-ink-tertiary">{venue.address.trim()}</p>
          ) : null}
        </div>
      </div>

      <Divider />

      {/* Узел 3525:14947: строки «подпись / значение» через 12. */}
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-flow-summary-label text-ink-secondary">{row.label}</dt>
            <dd
              className={
                row.value
                  ? "min-w-0 break-words text-right text-flow-summary-value text-ink"
                  : "min-w-0 text-right text-flow-summary-label text-ink-tertiary"
              }
            >
              {row.value ?? texts.notChosen}
            </dd>
          </div>
        ))}
      </dl>

      <Divider />

      {reschedule ? (
        <p className="text-bodyS text-ink-secondary">{texts.rescheduleHint}</p>
      ) : (
        // Узел 3525:14967: «К оплате сейчас» 15/22 SemiBold и «0 ₸» 20/28 Bold.
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-flow-total text-ink">{texts.totalLabel}</span>
            <span className="text-flow-total-value text-ink">{texts.totalValue}</span>
          </div>
          <p className="text-bodyS text-ink-tertiary">{texts.totalHint}</p>
        </div>
      )}
      </div>

      {/* Отказ сервера стоит НАД кнопкой и в одном с ней контейнере — как
          `continueHint` в футере приложения: он объясняет именно её и
          отдельно от неё уехать не может (в свёрнутой сводке его бы не
          увидели). */}
      <BottomBar desktop="inline" className="lg:gap-flow-summary-gap">
        {failure ? <StateMessage title={failure.title} text={failure.text} tone="danger" /> : null}
        <Actions action={action} reschedule={reschedule} />
      </BottomBar>
    </section>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={cx("h-5 w-5 shrink-0 text-ink-secondary transition-transform", up && "rotate-180")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

function Divider() {
  return <hr className="border-0 border-t border-line" />;
}

/**
 * Кнопка 3525:14971: 48 высотой, радиус 14, кегль 16/24 SemiBold — это
 * `Button size="submit"`. Четыре облика, и все про честность:
 *   • гость не вошёл → ССЫЛКА на вход, помнящая эту страницу с выбором;
 *   • время не выбрано → выключена и говорит «Выберите время»;
 *   • сессия читается → выключена без подписи-обмана;
 *   • иначе → отправка, на время которой кнопка заблокирована.
 */
function Actions({ action, reschedule }: { action: SummaryAction; reschedule: boolean }) {
  const { t } = useLocale();
  const texts = t.web.booking.summary;
  const label = reschedule ? texts.reschedule : texts.submit;
  const busyLabel = reschedule ? texts.rescheduling : texts.submitting;

  let control: ReactNode;
  switch (action.kind) {
    case "signIn":
      control = (
        <>
          <Button size="submit" block asLink href={action.href}>
            {texts.signIn}
          </Button>
          <p className="text-center text-bodyS text-ink-tertiary">{texts.signInHint}</p>
        </>
      );
      break;
    case "pickTime":
      control = (
        <Button size="submit" block disabled>
          {texts.pickTime}
        </Button>
      );
      break;
    case "waiting":
      control = (
        <Button size="submit" block disabled>
          {label}
        </Button>
      );
      break;
    case "submit":
      control = (
        <Button
          size="submit"
          block
          loading={action.submitting}
          disabled={action.blocked}
          onClick={action.onSubmit}
        >
          {action.submitting ? busyLabel : label}
        </Button>
      );
      break;
  }

  return <div className="flex flex-col gap-2.5">{control}</div>;
}
