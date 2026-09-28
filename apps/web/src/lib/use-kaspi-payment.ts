"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingPayment, PaymentMethod } from "@bookeat/api/client";

import { repository, isApiConfigured } from "@web/lib/api";
import { useAuth } from "@web/lib/auth";
import {
  clearKaspiPaymentAttempt,
  readKaspiPaymentAttempt,
  writeKaspiPaymentAttempt,
} from "@web/lib/kaspi-payment-session";
import { newIdempotencyKey, nextPollDelayMs, paymentPhase, type PaymentPhase } from "@web/lib/kaspi-payment";

/**
 * Оплата предзаказа через Kaspi на сайте — веб-версия
 * `apps/mobile/src/hooks/useKaspiPayment.ts`: тот же `POST /bookings/:id/payment`
 * + опрос `GET /payments/:id`, но без WebView и без AppState. У сайта оплата —
 * обычный переход на `payment.paymentUrl` (страница Kaspi, `pay.kaspi.kz`) и
 * возврат браузером на `return_url`, то есть НА ЭТУ ЖЕ страницу — целой
 * перезагрузкой. Поэтому id платежа и ключ идемпотентности переживают в
 * `sessionStorage` (`kaspi-payment-session.ts`), а не в React-стейте, и опрос
 * идёт, пока вкладка видима (`document.visibilityState`), а не пока
 * приложение на переднем плане.
 */

const paymentQueryKey = (paymentId: string | null) => ["kaspi-payment", paymentId] as const;

interface CreatePaymentVariables {
  bookingId: string;
  returnUrl: string;
  idempotencyKey: string;
  method?: PaymentMethod;
}

/** Создаёт счёт (`POST /bookings/:id/payment`). Двойной клик защищён тем же
 * приёмом, что на мобилке: реф `inFlight` плюс `Idempotency-Key`, который
 * сервер сам сводит к одному платежу на повтор ключа. */
function useCreateBookingPayment() {
  const queryClient = useQueryClient();
  const inFlight = useRef<Set<string>>(new Set());

  return useMutation<BookingPayment, unknown, CreatePaymentVariables>({
    mutationFn: async ({ bookingId, returnUrl, idempotencyKey, method }) => {
      if (inFlight.current.has(bookingId)) {
        throw new Error(`Payment already in flight for ${bookingId}`);
      }
      inFlight.current.add(bookingId);
      try {
        return await repository.createBookingPayment(bookingId, { returnUrl, method }, idempotencyKey);
      } finally {
        inFlight.current.delete(bookingId);
      }
    },
    onSuccess: (payment) => {
      queryClient.setQueryData(paymentQueryKey(payment.id), payment);
    },
  });
}

/** Вкладка видима прямо сейчас. `document` есть только на клиенте — страница
 * уже под `"use client"`, но начальное значение на сервере должно быть
 * безопасным (не запускать опрос до гидратации). */
function useTabVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(document.visibilityState === "visible");
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/** Опрашивает `GET /payments/:id`, пока это имеет смысл — ритм и условия
 * останова в `nextPollDelayMs` (чистая функция, покрыта тестами). */
function usePaymentPolling(paymentId: string | null) {
  const { signedIn } = useAuth();
  const tabVisible = useTabVisible();
  const foregroundAt = useRef<number>(Date.now());
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
    foregroundAt.current = Date.now();
  }, [paymentId]);

  useEffect(() => {
    if (tabVisible) foregroundAt.current = Date.now();
  }, [tabVisible]);

  return useQuery<BookingPayment | null>({
    queryKey: paymentQueryKey(paymentId),
    queryFn: () => {
      if (!paymentId) throw new Error("Missing payment id");
      return repository.getPayment(paymentId);
    },
    enabled: isApiConfigured && Boolean(paymentId) && signedIn,
    staleTime: 0,
    retry: 1,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const payment = query.state.data ?? null;
      const now = Date.now();
      return nextPollDelayMs({
        status: payment?.status ?? null,
        expiresAt: payment?.expiresAt ?? null,
        now,
        appActive: tabVisible,
        sinceForegroundMs: now - foregroundAt.current,
        sinceStartMs: now - startedAt.current,
      });
    },
  });
}

export interface KaspiPaymentFlow {
  phase: PaymentPhase;
  payment: BookingPayment | null;
  creating: boolean;
  error: unknown;
  /** Создаёт счёт и СРАЗУ переходит на `payment.paymentUrl` (замена адреса
   * вкладки, как настоящий переход на оплату — не `window.open`, у которого
   * блокировщики всплывающих окон вырезают вызов без прямого клика,
   * произошедшего асинхронно после ответа сервера). */
  pay: (method?: PaymentMethod) => void;
  /** «Открыть оплату снова» — тот же СУЩЕСТВУЮЩИЙ счёт (`awaiting`), новый не
   * создаётся. `null`, если сервер не прислал (или уже не признаёт)
   * `paymentUrl` для текущего платежа — тогда кнопка неактивна. */
  openLink: string | null;
  /** Новая ссылка взамен мёртвой: новый ключ идемпотентности. */
  renew: () => void;
  /** «Я оплатил, проверить» — спросить сервер прямо сейчас. */
  check: () => void;
  now: number;
}

export function useTickingNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Всё состояние оплаты одной брони в одном месте — веб-версия
 * `useKaspiPaymentFlow` с мобилки.
 *
 * `existing` — платёж, который экран уже знает из `GET /bookings/:id/payment`
 * (эта ручка отдаёт только УЖЕ ОПЛАЧЕННЫЙ платёж): гость, вернувшийся на
 * билет через час, сразу видит «оплачено», а не кнопку оплаты.
 */
export function useKaspiPaymentFlow(input: {
  bookingId: string;
  existing: BookingPayment | null | undefined;
  /** Выключает создание и опрос: бронь, за которую платить нечего. */
  enabled: boolean;
}): KaspiPaymentFlow {
  const create = useCreateBookingPayment();
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const idempotencyKey = useRef<string>("");
  const restoredFor = useRef<string | null>(null);

  // Восстановление попытки после возврата из Kaspi — ПОЛНАЯ перезагрузка
  // страницы стирает весь React-стейт этого хука.
  useEffect(() => {
    if (restoredFor.current === input.bookingId) return;
    restoredFor.current = input.bookingId;
    const attempt = readKaspiPaymentAttempt(input.bookingId);
    if (attempt) {
      idempotencyKey.current = attempt.idempotencyKey;
      setPaymentId(attempt.paymentId);
    } else {
      idempotencyKey.current = newIdempotencyKey();
    }
  }, [input.bookingId]);

  const polled = usePaymentPolling(input.enabled ? paymentId : null);

  // Порядок: свежий опрос → ответ создания → то, что знала бронь.
  const payment: BookingPayment | null = polled.data ?? create.data ?? input.existing ?? null;

  useEffect(() => {
    if (!create.data) return;
    setPaymentId(create.data.id);
    writeKaspiPaymentAttempt(input.bookingId, {
      paymentId: create.data.id,
      idempotencyKey: idempotencyKey.current,
    });
  }, [create.data, input.bookingId]);

  const ticking =
    input.enabled && payment !== null && payment.status !== "captured" && Boolean(payment.expiresAt);
  const now = useTickingNow(ticking);

  const phase = input.enabled ? paymentPhase(payment, now) : "idle";

  // Терминальное состояние (оплачено или ссылка мертва) — попытка больше не
  // нужна, следующий визит должен предложить оплатить заново (новый счёт), а
  // не молча воскресить старую.
  useEffect(() => {
    if (phase === "paid" || phase === "dead") clearKaspiPaymentAttempt(input.bookingId);
  }, [phase, input.bookingId]);

  const requestInFlight = useRef(false);

  // Ключ идемпотентности привязан к способу: тот же ключ с другим `method`
  // сервер свёл бы к ПРЕЖНЕМУ счёту (например, Kaspi вместо выбранной карты).
  const lastMethod = useRef<PaymentMethod | undefined>(undefined);

  const start = useCallback((method?: PaymentMethod) => {
    if (!input.enabled || requestInFlight.current) return;
    if (method !== lastMethod.current) {
      idempotencyKey.current = newIdempotencyKey();
      setPaymentId(null);
      lastMethod.current = method;
    }
    if (typeof window === "undefined") return;
    requestInFlight.current = true;
    create.mutate(
      {
        bookingId: input.bookingId,
        // Возврат — на ПОЛНОЭКРАННУЮ страницу оплаты
        // (`app/bookings/[id]/payment`), не на сам билет: она же держит
        // отсчёт и «я оплатил, проверить» после того, как Kaspi полностью
        // перезагрузит вкладку на этот адрес.
        returnUrl: `${window.location.origin}/bookings/${encodeURIComponent(input.bookingId)}/payment`,
        idempotencyKey: idempotencyKey.current,
        method,
      },
      {
        onSuccess: (created) => {
          if (created.paymentUrl) window.location.assign(created.paymentUrl);
        },
        onSettled: () => {
          requestInFlight.current = false;
        },
      },
    );
  }, [create, input.bookingId, input.enabled]);

  const pay = start;

  const renew = useCallback(() => {
    if (!input.enabled || requestInFlight.current) return;
    idempotencyKey.current = newIdempotencyKey();
    setPaymentId(null);
    clearKaspiPaymentAttempt(input.bookingId);
    create.reset();
    start(lastMethod.current);
  }, [create, input.bookingId, input.enabled, start]);

  return {
    phase,
    payment,
    creating: create.isPending,
    error: create.error,
    pay,
    openLink: payment?.paymentUrl ?? null,
    renew,
    check: () => void polled.refetch(),
    now,
  };
}
