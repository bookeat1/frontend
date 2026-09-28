/**
 * Предпросмотр сервисного сбора ДО создания платежа. Зеркало бэкенда
 * `internal/domain/payment_money.go: GrossUpForAcquirerWithMinimum`: тот же
 * потолочный gross-up и то же «побеждает большее из процента и минимума».
 * Реальную сумму всегда называет сервер (`BookingPayment.amountMinor`), здесь
 * только показ гостю до нажатия «Оплатить».
 *
 * Всё в минорных единицах, целочисленно (BigInt: base × 10000 не должен
 * терять точность на больших суммах).
 */

export interface PaymentFeeConfig {
  /** Ставка эквайринга в базисных пунктах (350 = 3.5%). */
  rateBps: number;
  /** Минимум за операцию в минорных единицах (2500 = 25 ₸). */
  minFeeMinor: number;
}

export interface PaymentBreakdown {
  baseMinor: number;
  feeMinor: number;
  totalMinor: number;
}

const BPS_DENOMINATOR = 10_000;

/**
 * `null` — сбора нет или посчитать нельзя (нет конфигурации, ставка вне
 * [0, 10000), отрицательный минимум, нулевая/некорректная база, обе части 0,
 * base × 10000 выходит за безопасное целое): экран тогда не рисует строки
 * сбора и показывает базу как есть.
 */
export function computePaymentBreakdown(
  baseMinor: number | null | undefined,
  config: PaymentFeeConfig | null | undefined,
): PaymentBreakdown | null {
  if (!config || typeof baseMinor !== "number") return null;
  const { rateBps, minFeeMinor } = config;
  if (!Number.isInteger(baseMinor) || baseMinor <= 0) return null;
  if (baseMinor > Math.floor(Number.MAX_SAFE_INTEGER / BPS_DENOMINATOR)) return null;
  if (!Number.isInteger(rateBps) || !Number.isInteger(minFeeMinor)) return null;
  if (rateBps < 0 || rateBps >= BPS_DENOMINATOR || minFeeMinor < 0) return null;
  if (rateBps === 0 && minFeeMinor === 0) return null;
  if (minFeeMinor > Number.MAX_SAFE_INTEGER - baseMinor) return null;

  let total = baseMinor;
  if (rateBps > 0) {
    const denom = BPS_DENOMINATOR - rateBps;
    // Потолочное деление неотрицательных целых — как в Go.
    total = Math.floor((baseMinor * BPS_DENOMINATOR + denom - 1) / denom);
  }
  total = Math.max(total, baseMinor + minFeeMinor);
  const feeMinor = total - baseMinor;
  if (feeMinor <= 0) return null;
  return { baseMinor, feeMinor, totalMinor: total };
}
