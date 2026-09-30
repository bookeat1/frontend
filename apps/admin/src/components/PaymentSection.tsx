"use client";

import { useState, type ReactNode } from "react";

import { t } from "@/lib/i18n";
import { PaymentAcceptanceCard } from "./PaymentAcceptanceCard";
import { PaymentMethodsCard } from "./PaymentMethodsCard";

/**
 * Единый блок «Оплата» формы заведения (только суперадмин): одна подложка, один
 * заголовок, сверху вниз:
 *
 *  1. главный переключатель онлайн-оплаты и 2. способы (Карта, Kaspi) —
 *     `PaymentMethodsCard`;
 *  3. «Счёт Kaspi» (компания, на чей счёт идут деньги) — `PaymentAcceptanceCard`,
 *     только пока флажок Kaspi отмечен;
 *  4. `children` — место для следующих блоков (например, «Предзаказ требует
 *     оплаты»): каждый — своя карточка с собственной кнопкой «Сохранить» и
 *     собственным `onDirtyChange`, которые родитель подключает сам.
 *
 * Каждая часть сохраняется СВОЕЙ кнопкой, как и раньше; о несохранённом вводе
 * они сообщают родителю через `onMethodsDirtyChange`/`onCompanyDirtyChange`.
 *
 * Блок «Счёт Kaspi» остаётся на экране, если в нём есть несохранённая правка,
 * даже когда флажок Kaspi сняли: размонтирование молча выбросило бы ввод, а
 * форма заведения уже не смогла бы про него предупредить.
 */
const copy = t.admin.paymentSection;

export function PaymentSection({
  restaurantId,
  onMethodsDirtyChange,
  onCompanyDirtyChange,
  children,
}: {
  restaurantId: string;
  onMethodsDirtyChange?: (dirty: boolean) => void;
  onCompanyDirtyChange?: (dirty: boolean) => void;
  /** Дополнительные карточки оплаты под блоком Kaspi. */
  children?: ReactNode;
}) {
  const [kaspiChecked, setKaspiChecked] = useState(false);
  const [companyDirty, setCompanyDirty] = useState(false);
  const showCompany = kaspiChecked || companyDirty;

  return (
    <section className="rounded-card bg-surface p-lg" aria-labelledby={`payment-section-${restaurantId}`}>
      <h2 id={`payment-section-${restaurantId}`} className="text-base font-semibold text-text">
        {copy.title}
      </h2>
      <p className="mt-xs max-w-prose text-[13px] text-text-muted">{copy.description}</p>

      <div className="mt-lg flex flex-col gap-lg">
        <PaymentMethodsCard
          embedded
          restaurantId={restaurantId}
          onDirtyChange={onMethodsDirtyChange}
          onKaspiChange={setKaspiChecked}
        />
        {showCompany ? (
          <div className="border-t border-hairline pt-lg">
            <PaymentAcceptanceCard
              embedded
              restaurantId={restaurantId}
              onDirtyChange={(dirty) => {
                setCompanyDirty(dirty);
                onCompanyDirtyChange?.(dirty);
              }}
            />
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
