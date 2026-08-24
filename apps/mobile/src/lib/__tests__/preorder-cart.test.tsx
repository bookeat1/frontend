import type { Preorder } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Корзина предзаказа у СУЩЕСТВУЮЩЕЙ брони.
 *
 * Ручка `PUT /bookings/:id/preorder` ЗАМЕНЯЕТ состав целиком, поэтому здесь
 * проверяется главное, что ломается тихо: корзина обязана начинаться с уже
 * прикреплённых блюд. Иначе гость, добавивший одно блюдо к брони, стёр бы всё,
 * что заказал раньше, и узнал бы об этом за столом.
 */

const getPreorder = vi.fn();
const setPreorder = vi.fn();

vi.mock("../repository", () => ({
  useRepository: () => ({ getPreorder, setPreorder }),
}));

const { usePreorderCart } = await import("../preorder-cart");

function preorder(items: Preorder["items"]): Preorder {
  return { bookingId: "b-1", items, totalMinor: 0, currency: "KZT" };
}

function line(id: string, name: string, quantity: number): Preorder["items"][number] {
  return {
    id: `line-${id}`,
    menuItemId: id,
    name,
    priceMinor: 1000,
    quantity,
    totalMinor: 1000 * quantity,
    comment: null,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getPreorder.mockReset();
  setPreorder.mockReset();
  setPreorder.mockResolvedValue(preorder([]));
});

describe("корзина предзаказа существующей брони", () => {
  it("начинается с того, что уже заказано, и досылает всё вместе", async () => {
    getPreorder.mockResolvedValue(preorder([line("d1", "Плов", 2)]));

    const { result } = renderHook(() => usePreorderCart("b-1"), { wrapper });
    await waitFor(() => expect(result.current.lines).toHaveLength(1));

    act(() => {
      result.current.setQuantity({ menuItemId: "d2", name: "Хумус", priceMinor: 2450 }, 1);
    });
    await act(async () => {
      await result.current.save.mutateAsync();
    });

    const sent = setPreorder.mock.calls[0][1];
    expect(sent).toHaveLength(2);
    expect(sent.map((l: { menuItemId: string }) => l.menuItemId).sort()).toEqual(["d1", "d2"]);
  });

  it("нулевое количество убирает блюдо из состава", async () => {
    getPreorder.mockResolvedValue(preorder([line("d1", "Плов", 2)]));

    const { result } = renderHook(() => usePreorderCart("b-1"), { wrapper });
    await waitFor(() => expect(result.current.lines).toHaveLength(1));

    act(() => {
      result.current.setQuantity({ menuItemId: "d1", name: "Плов", priceMinor: 1000 }, 0);
    });
    await act(async () => {
      await result.current.save.mutateAsync();
    });

    expect(setPreorder.mock.calls[0][1]).toEqual([]);
  });

  it("позицию без идентификатора блюда в корзину не берём: её нельзя отправить обратно", async () => {
    // Такие строки заводит заведение в кабинете вручную.
    getPreorder.mockResolvedValue(
      preorder([{ ...line("d1", "Плов", 1), menuItemId: null }]),
    );

    const { result } = renderHook(() => usePreorderCart("b-1"), { wrapper });
    await waitFor(() => expect(getPreorder).toHaveBeenCalled());

    expect(result.current.lines).toEqual([]);
  });
});
