import type { BookingPayment, RestaurantRepository } from "@bookeat/api";
import { RepositoryError } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKaspiPaymentFlow } from "../useKaspiPayment";

/**
 * Оплата предзаказа через Kaspi — поведение, которое стоит настоящих денег.
 *
 * У Kaspi НЕТ ПЕСОЧНИЦЫ: каждый успешный `POST /bookings/:id/payment` создаёт
 * живой счёт. Поэтому всё, что здесь проверяется, проверяется на моке — и
 * проверяется целиком, а не «на глаз в симуляторе»:
 *
 *   • двойное нажатие НЕ создаёт второй счёт;
 *   • опрос доводит экран до «оплачено» сам и после этого прекращается;
 *   • истёкшая ссылка требует НОВЫЙ ключ идемпотентности — иначе сервер
 *     честно вернул бы ту же мёртвую ссылку;
 *   • отказ сервера не превращается в «оплачено».
 */

const repository = {
  createBookingPayment: vi.fn(),
  getPayment: vi.fn(),
} as unknown as RestaurantRepository & {
  createBookingPayment: ReturnType<typeof vi.fn>;
  getPayment: ReturnType<typeof vi.fn>;
};

vi.mock("../../lib/repository", () => ({
  useRepository: () => repository,
}));
vi.mock("../../lib/auth", () => ({
  useAuth: () => ({ status: "signed-in", ensureFreshToken: async () => "token" }),
}));

function payment(overrides: Partial<BookingPayment> = {}): BookingPayment {
  return {
    id: "pay-1",
    bookingId: "b-1",
    purpose: "preorder",
    status: "created",
    amountMinor: 1_200_000,
    currency: "KZT",
    paymentUrl: "https://pay.kaspi.kz/pay/abcdef",
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderFlow(existing: BookingPayment | null = null) {
  return renderHook(
    () =>
      useKaspiPaymentFlow({
        bookingId: "b-1",
        returnUrl: "bookeat://booking/b-1",
        existing,
        enabled: true,
      }),
    { wrapper },
  );
}

beforeEach(() => {
  repository.createBookingPayment.mockReset();
  repository.getPayment.mockReset();
});

describe("создание счёта", () => {
  it("нажатие создаёт счёт и отдаёт ссылку Kaspi", async () => {
    repository.createBookingPayment.mockResolvedValue(payment());
    repository.getPayment.mockResolvedValue(payment());

    const { result } = renderFlow();
    expect(result.current.phase).toBe("idle");

    act(() => result.current.pay());
    await waitFor(() => expect(result.current.phase).toBe("awaiting"));

    expect(result.current.payment?.paymentUrl).toBe("https://pay.kaspi.kz/pay/abcdef");
    expect(repository.createBookingPayment).toHaveBeenCalledWith(
      "b-1",
      { returnUrl: "bookeat://booking/b-1" },
      expect.stringMatching(/^pay-/),
    );
  });

  it("выключенный блок не создаёт счёт вовсе", async () => {
    const { result } = renderHook(
      () =>
        useKaspiPaymentFlow({
          bookingId: "b-1",
          returnUrl: "bookeat://booking/b-1",
          existing: null,
          enabled: false,
        }),
      { wrapper },
    );
    act(() => result.current.pay());
    expect(repository.createBookingPayment).not.toHaveBeenCalled();
  });
});

describe("двойное нажатие", () => {
  it("два нажатия подряд — ОДИН запрос и один счёт", async () => {
    // Ответ намеренно затянут: именно в эту щель и попадает второе нажатие,
    // пока React ещё не прокинул `disabled` в кнопку.
    let release: (value: BookingPayment) => void = () => {};
    repository.createBookingPayment.mockReturnValue(
      new Promise<BookingPayment>((resolve) => {
        release = resolve;
      }),
    );
    repository.getPayment.mockResolvedValue(payment());

    const { result } = renderFlow();
    act(() => {
      result.current.pay();
      result.current.pay();
      result.current.pay();
    });

    // `mutate` запускает mutationFn асинхронно, поэтому ждём — и ждём именно
    // ОДНОГО вызова: два других сторож `inFlight` не выпустил в сеть.
    await waitFor(() => expect(repository.createBookingPayment).toHaveBeenCalledTimes(1));

    await act(async () => {
      release(payment());
    });
    await waitFor(() => expect(result.current.phase).toBe("awaiting"));
    expect(repository.createBookingPayment).toHaveBeenCalledTimes(1);
  });

  it("повтор ПОСЛЕ ответа идёт с ТЕМ ЖЕ ключом — сервер отдаст прежний счёт", async () => {
    repository.createBookingPayment.mockResolvedValue(payment());
    repository.getPayment.mockResolvedValue(payment());

    const { result } = renderFlow();
    act(() => result.current.pay());
    await waitFor(() => expect(result.current.phase).toBe("awaiting"));
    act(() => result.current.pay());
    await waitFor(() => expect(repository.createBookingPayment).toHaveBeenCalledTimes(2));

    const [first, second] = repository.createBookingPayment.mock.calls;
    expect(second[2]).toBe(first[2]);
  });
});

describe("опрос до оплаты", () => {
  it("сам доходит до «оплачено» и после этого больше не спрашивает", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      repository.createBookingPayment.mockResolvedValue(payment());
      repository.getPayment
        .mockResolvedValueOnce(payment())
        .mockResolvedValue(payment({ status: "captured" }));

      const { result } = renderFlow();
      act(() => result.current.pay());
      await waitFor(() => expect(result.current.phase).toBe("awaiting"));

      // Частое окно опроса — 3 секунды между заходами.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_500);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_500);
      });
      await waitFor(() => expect(result.current.phase).toBe("paid"));

      const callsAtPaid = repository.getPayment.mock.calls.length;
      // Терминальный статус останавливает опрос: минута тишины не должна
      // добавить ни одного запроса.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(repository.getPayment.mock.calls.length).toBe(callsAtPaid);
    } finally {
      vi.useRealTimers();
    }
  });

  it("«я оплатил, проверить» спрашивает сервер немедленно", async () => {
    repository.createBookingPayment.mockResolvedValue(payment());
    repository.getPayment.mockResolvedValue(payment({ status: "captured" }));

    const { result } = renderFlow();
    act(() => result.current.pay());
    await waitFor(() => expect(result.current.payment).not.toBeNull());

    act(() => result.current.check());
    await waitFor(() => expect(result.current.phase).toBe("paid"));
  });

  it("уже оплаченная бронь показывает «оплачено» без единого нажатия", () => {
    const { result } = renderFlow(payment({ status: "captured" }));
    expect(result.current.phase).toBe("paid");
    expect(repository.createBookingPayment).not.toHaveBeenCalled();
  });
});

describe("истёкшая ссылка", () => {
  it("срок вышел — ссылка мертва, а новая берёт НОВЫЙ ключ", async () => {
    repository.createBookingPayment.mockResolvedValue(
      payment({ expiresAt: new Date(Date.now() - 1_000).toISOString() }),
    );
    repository.getPayment.mockResolvedValue(
      payment({ expiresAt: new Date(Date.now() - 1_000).toISOString() }),
    );

    const { result } = renderFlow();
    act(() => result.current.pay());
    await waitFor(() => expect(result.current.phase).toBe("dead"));

    repository.createBookingPayment.mockResolvedValue(payment({ id: "pay-2" }));
    act(() => result.current.renew());
    await waitFor(() => expect(repository.createBookingPayment).toHaveBeenCalledTimes(2));

    const [first, second] = repository.createBookingPayment.mock.calls;
    expect(second[2]).not.toBe(first[2]);
  });

  it("сервер сказал expired — тоже мертва, даже если срок ещё не вышел", async () => {
    repository.createBookingPayment.mockResolvedValue(payment({ status: "expired" }));
    repository.getPayment.mockResolvedValue(payment({ status: "expired" }));

    const { result } = renderFlow();
    act(() => result.current.pay());
    await waitFor(() => expect(result.current.phase).toBe("dead"));
  });
});

describe("отказы", () => {
  it("422 (платежи не подключены) не превращается в «оплачено»", async () => {
    repository.createBookingPayment.mockRejectedValue(
      new RepositoryError("payments are not enabled", undefined, 422),
    );

    const { result } = renderFlow();
    act(() => result.current.pay());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.phase).toBe("idle");
    expect(result.current.payment).toBeNull();
  });

  it("нет сети — состояние не меняется, счёт не создан", async () => {
    repository.createBookingPayment.mockRejectedValue(
      new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true),
    );

    const { result } = renderFlow();
    act(() => result.current.pay());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.phase).toBe("idle");
  });

  it("сбой опроса не отменяет уже созданную ссылку", async () => {
    repository.createBookingPayment.mockResolvedValue(payment());
    repository.getPayment.mockRejectedValue(new RepositoryError("boom", undefined, 500));

    const { result } = renderFlow();
    act(() => result.current.pay());
    await waitFor(() => expect(result.current.phase).toBe("awaiting"));
    // Опрос падает, но ссылка, которую вернуло создание, никуда не делась.
    expect(result.current.payment?.paymentUrl).toBe("https://pay.kaspi.kz/pay/abcdef");
  });
});
