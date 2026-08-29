import type { BookingPayment } from "@bookeat/api";
import { RepositoryError } from "@bookeat/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "../lib/auth";
import {
  nextPollDelayMs,
  newIdempotencyKey,
  paymentPhase,
  type PaymentPhase,
} from "../lib/kaspi-payment";
import { useRepository } from "../lib/repository";

/**
 * Оплата предзаказа через Kaspi: создание счёта и опрос его состояния.
 *
 * Разделено на две части намеренно. `useCreateBookingPayment` — мутация,
 * которая создаёт РЕАЛЬНЫЙ платёжный счёт (у Kaspi нет песочницы: каждый
 * успешный вызов — живая ссылка на живые деньги). `usePaymentPolling` —
 * читающий запрос, у которого нет побочных эффектов вовсе.
 */

/** Ключ кэша одного платежа. */
export const paymentQueryKey = (paymentId: string | null) => ["payment", paymentId] as const;

export interface CreatePaymentVariables {
  bookingId: string;
  /** Куда вернуть гостя после страницы оплаты. Kaspi его игнорирует (адаптер
   * не читает ReturnURL вовсе), но ручка пустой не принимает. */
  returnUrl: string;
  /** Ключ идемпотентности. Один ключ = одна попытка; см. `newIdempotencyKey`. */
  idempotencyKey: string;
}

/**
 * Создаёт счёт (`POST /bookings/:id/payment`).
 *
 * ДВОЙНОЕ НАЖАТИЕ. Защит три, и они независимы — ни одной по отдельности не
 * хватает:
 *
 *   1. `Idempotency-Key`. Сервер scope-ит ключ на бронь И на актора и на
 *      повтор ОТДАЁТ ПРЕЖНИЙ платёж вместо создания второго
 *      (`CreateForBooking`, internal/usecase/payments/create.go). Это
 *      единственная защита, которая работает и после того, как приложение
 *      убили и перезапустили. Ключ живёт в `useKaspiPaymentFlow` и не
 *      меняется, пока гость сам не попросит новую ссылку.
 *   2. `inFlight` — второй вызов для той же брони не уходит в сеть вовсе.
 *      Нужен потому, что между двумя быстрыми нажатиями React ещё не успевает
 *      прокинуть `disabled` в кнопку.
 *   3. Кнопка выключена, пока `isPending`.
 *
 * И даже если бы всё три обошли: у брони может быть только один живой платёж,
 * второй создать нельзя — сервер ответит 409 (`GetLiveByBookingID` в том же
 * файле).
 */
export function useCreateBookingPayment() {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const inFlight = React.useRef<Set<string>>(new Set());

  return useMutation<BookingPayment, unknown, CreatePaymentVariables>({
    mutationFn: async ({ bookingId, returnUrl, idempotencyKey }) => {
      if (inFlight.current.has(bookingId)) {
        throw new RepositoryError(`Payment already in flight for ${bookingId}`, undefined, 409);
      }
      inFlight.current.add(bookingId);
      try {
        return await repository.createBookingPayment(bookingId, { returnUrl }, idempotencyKey);
      } finally {
        inFlight.current.delete(bookingId);
      }
    },
    onSuccess: (payment) => {
      // Опрос стартует с уже известного состояния, без лишнего первого
      // запроса и без мигания «загружаем».
      queryClient.setQueryData(paymentQueryKey(payment.id), payment);
    },
  });
}

/**
 * Опрашивает `GET /payments/:id`, пока это имеет смысл.
 *
 * Ритм и условия останова живут в `nextPollDelayMs` (чистая функция, покрыта
 * тестами) — здесь только его подключение к react-query и слежение за тем,
 * ушло ли приложение в фон.
 */
export function usePaymentPolling(paymentId: string | null) {
  const repository = useRepository();
  const { status: authStatus } = useAuth();
  const [appActive, setAppActive] = React.useState(() => AppState.currentState !== "background");
  // Момент последнего возвращения на передний план — от него отсчитывается
  // «частое» окно опроса. Стартовое значение = сейчас: экран, открытый сразу
  // после возврата из Kaspi, должен опрашивать часто с первой же секунды.
  const foregroundAt = React.useRef<number>(Date.now());
  const startedAt = React.useRef<number>(Date.now());

  // Новая ссылка — новый отсчёт потолка `POLL_MAX_MS`.
  React.useEffect(() => {
    startedAt.current = Date.now();
    foregroundAt.current = Date.now();
  }, [paymentId]);

  React.useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const active = next !== "background";
      // Возврат на передний план — это ровно тот момент, когда гость мог
      // только что оплатить в приложении Kaspi. Сбрасываем окно, чтобы
      // следующая минута опрашивалась часто.
      if (active) foregroundAt.current = Date.now();
      setAppActive(active);
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  return useQuery<BookingPayment | null>({
    queryKey: paymentQueryKey(paymentId),
    queryFn: () => {
      if (!paymentId) throw new Error("Missing payment id");
      return repository.getPayment(paymentId);
    },
    enabled: Boolean(paymentId) && authStatus === "signed-in",
    // Ответ протухает мгновенно: смысл этого запроса — узнать, не изменилось
    // ли состояние прямо сейчас.
    staleTime: 0,
    // Одна повторная попытка вместо трёх: при опросе следующий заход и так
    // случится через несколько секунд, длинный retry только съедает батарею.
    retry: 1,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const payment = query.state.data ?? null;
      const now = Date.now();
      return nextPollDelayMs({
        status: payment?.status ?? null,
        expiresAt: payment?.expiresAt ?? null,
        now,
        appActive,
        sinceForegroundMs: now - foregroundAt.current,
        sinceStartMs: now - startedAt.current,
      });
    },
  });
}

export interface KaspiPaymentFlow {
  /** Что показывать: кнопку, отсчёт, «оплачено» или «ссылка истекла». */
  phase: PaymentPhase;
  /** Платёж, о котором мы знаем больше всего: свежий ответ опроса, иначе тот,
   * что вернуло создание, иначе уже оплаченный платёж самой брони. */
  payment: BookingPayment | null;
  /** Идёт создание счёта. */
  creating: boolean;
  /** Отказ последнего создания счёта; `null`, если всё в порядке. */
  error: unknown;
  /** Создать счёт. Повторные вызовы во время полёта запроса безвредны. */
  pay: () => void;
  /** Запросить НОВУЮ ссылку взамен мёртвой: новый ключ идемпотентности. */
  renew: () => void;
  /** Спросить сервер прямо сейчас — кнопка «я оплатил, проверить». Нужна
   * потому, что вебхук Kaspi доезжает не мгновенно, и гость, вернувшийся
   * раньше него, иначе просто ждёт следующего тика опроса. */
  check: () => void;
  /** Момент, на который посчитана `phase`. Отсчёт рисуется от него, чтобы
   * таймер экрана и решение «ссылка ещё жива» шли по ОДНИМ часам. */
  now: number;
}

/**
 * Секундный тик, пока он нужен.
 *
 * Отсчёт до смерти ссылки обязан двигаться сам: гость смотрит на экран и
 * ничего не нажимает. Тикаем ТОЛЬКО пока есть незавершённый платёж — на
 * оплаченной и на пустой броне таймер не заводится вовсе.
 */
function useTickingNow(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Всё состояние оплаты одной брони в одном месте.
 *
 * `existing` — платёж, который экран уже знает из `GET /bookings/:id/payment`
 * (эта ручка отдаёт только «живой» платёж, то есть в нашем случае —
 * УЖЕ ОПЛАЧЕННЫЙ). Он нужен, чтобы гость, вернувшийся на экран через час,
 * сразу видел «оплачено», а не кнопку оплаты.
 */
export function useKaspiPaymentFlow(input: {
  bookingId: string;
  returnUrl: string;
  existing: BookingPayment | null | undefined;
  /** Выключает и создание, и опрос: бронь, за которую платить нечего. */
  enabled: boolean;
}): KaspiPaymentFlow {
  const create = useCreateBookingPayment();
  const [paymentId, setPaymentId] = React.useState<string | null>(null);
  // Ключ идемпотентности ЖИВЁТ МЕЖДУ НАЖАТИЯМИ. Пока он один и тот же, любое
  // повторное нажатие — даже после потери ответа и перезапуска экрана —
  // возвращает тот же счёт, а не создаёт второй.
  const idempotencyKey = React.useRef<string>(newIdempotencyKey());

  const polled = usePaymentPolling(input.enabled ? paymentId : null);

  // Порядок важен: свежий опрос → ответ создания → то, что знала бронь.
  const payment: BookingPayment | null =
    polled.data ?? create.data ?? input.existing ?? null;

  // Счёт, созданный этой сессией, — то, что опрашиваем.
  React.useEffect(() => {
    if (create.data) setPaymentId(create.data.id);
  }, [create.data]);

  // Тикаем, только пока есть чему истекать: платёж существует и ещё не
  // закрыт сервером окончательно.
  const ticking =
    input.enabled &&
    payment !== null &&
    payment.status !== "captured" &&
    Boolean(payment.expiresAt);
  const now = useTickingNow(ticking);

  const phase = input.enabled ? paymentPhase(payment, now) : "idle";

  // Сторож двойного нажатия, и он именно РЕФ, а не `create.isPending`:
  // между двумя быстрыми тапами React ещё не успевает ни перерисовать кнопку,
  // ни выставить `isPending`, а реф меняется в тот же тик. Второй тап при
  // этом ТИХО игнорируется — он не должен превращаться в сообщение об
  // ошибке: гость не сделал ничего плохого, он просто нажал дважды.
  const requestInFlight = React.useRef(false);

  const start = React.useCallback(() => {
    if (!input.enabled || requestInFlight.current) return;
    requestInFlight.current = true;
    create.mutate(
      {
        bookingId: input.bookingId,
        returnUrl: input.returnUrl,
        idempotencyKey: idempotencyKey.current,
      },
      { onSettled: () => { requestInFlight.current = false; } },
    );
  }, [create, input.bookingId, input.enabled, input.returnUrl]);

  const pay = start;

  const renew = React.useCallback(() => {
    if (!input.enabled || requestInFlight.current) return;
    // Мёртвую ссылку заменяет НОВЫЙ счёт, значит нужен новый ключ: со старым
    // сервер честно вернул бы ту же истёкшую ссылку (он на повтор ключа
    // отдаёт прежний платёж, а не создаёт второй).
    idempotencyKey.current = newIdempotencyKey();
    setPaymentId(null);
    create.reset();
    start();
  }, [create, input.enabled, start]);

  return {
    phase,
    payment,
    creating: create.isPending,
    error: create.error,
    pay,
    renew,
    check: () => void polled.refetch(),
    now,
  };
}
