import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RepositoryError } from "@bookeat/api";
import type { AdminBooking, VenueToday, VenueTodayBooking } from "@bookeat/api/admin";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { VenueTodayBoard, type VenueTodayClient } from "../VenueTodayBoard";

/**
 * The operational block of the panel's landing page.
 *
 * Three things are guarded here, because each of them costs a real guest:
 *
 *  1. No unanswered requests ⇒ NO block. An always-present empty «Требуют
 *     ответа» card teaches staff to ignore that corner of the screen, which is
 *     exactly the corner that matters on a busy evening.
 *  2. A refused confirm must be readable. The server answers 422 with the
 *     English "invalid status transition" when somebody already answered the
 *     request — showing that (or a code) to a hostess tells her nothing about
 *     what to do next, and the useful action is to re-read the list.
 *  3. While an answer is in flight the buttons are inert, so a double tap on a
 *     slow tablet connection cannot fire two transitions at the same row.
 */

const RESTAURANT_ID = "r-1";

function row(over: Partial<VenueTodayBooking> = {}): VenueTodayBooking {
  return {
    id: "b-1",
    starts_at: "2026-07-28T19:30:00+05:00",
    name: "Айгерим",
    phone: "+7 701 000 00 00",
    guests: 2,
    status: "pending",
    created_at: "2026-07-28T18:00:00+05:00",
    waiting_minutes: 7,
    ...over,
  };
}

function view(over: Partial<VenueToday> = {}): VenueToday {
  return {
    awaiting: [],
    awaiting_total: 0,
    today: [],
    today_total: 0,
    guests: 0,
    ...over,
  };
}

function clientReturning(
  data: VenueToday,
  confirm: (bookingId: string) => Promise<AdminBooking> = async () => {
    throw new Error("confirm not expected in this test");
  },
): VenueTodayClient {
  return {
    venueDashboardToday: vi.fn(async () => data),
    confirmBooking: vi.fn(async (_r: string, bookingId: string) => confirm(bookingId)),
    rejectBooking: vi.fn(async () => {
      throw new Error("reject not expected in this test");
    }),
  };
}

function renderBoard(client: VenueTodayClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VenueTodayBoard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

describe("VenueTodayBoard", () => {
  it("renders no «Требуют ответа» block at all when nothing is waiting", async () => {
    renderBoard(clientReturning(view({ today: [row({ status: "confirmed" })], today_total: 1, guests: 2 })));

    await screen.findByText("Сегодня");
    expect(screen.queryByText("Требуют ответа")).toBeNull();
  });

  it("shows the first five requests and links to the rest", async () => {
    const awaiting = Array.from({ length: 5 }, (_, i) =>
      row({ id: `b-${i}`, name: `Гость ${i}` }),
    );
    renderBoard(clientReturning(view({ awaiting, awaiting_total: 17 })));

    await screen.findByText("Требуют ответа");
    expect(screen.getAllByRole("button", { name: "Подтвердить" })).toHaveLength(5);
    // 17 total, 5 on screen — the link must offer the twelve that are hidden,
    // not the seventeen that exist.
    expect(screen.getByText("ещё 12 →")).toBeTruthy();
  });

  it("dials the phone with a real tel: link", async () => {
    renderBoard(clientReturning(view({ awaiting: [row()], awaiting_total: 1 })));

    const link = await screen.findByText("+7 701 000 00 00");
    expect(link.getAttribute("href")).toBe("tel:+77010000000");
  });

  it("prints a human sentence when the server refuses the confirm", async () => {
    const client = clientReturning(
      view({ awaiting: [row()], awaiting_total: 1 }),
      async () => {
        throw new RepositoryError(
          "Server error 422",
          undefined,
          422,
          "invalid status transition",
          "invalid_status",
        );
      },
    );
    renderBoard(client);

    fireEvent.click(await screen.findByRole("button", { name: "Подтвердить" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("На эту заявку уже ответили");
    // Never the wire text or the code.
    expect(alert.textContent).not.toContain("invalid");
  });

  it("says «мы не знаем» rather than «ничего не изменилось» when the network died", async () => {
    const client = clientReturning(view({ awaiting: [row()], awaiting_total: 1 }), async () => {
      throw new RepositoryError("Network error requesting /confirm");
    });
    renderBoard(client);

    fireEvent.click(await screen.findByRole("button", { name: "Подтвердить" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Обновите список");
  });

  it("blocks both buttons while an answer is in flight, so a double tap sends one call", async () => {
    let release: (() => void) | undefined;
    const client = clientReturning(
      view({ awaiting: [row()], awaiting_total: 1 }),
      () =>
        new Promise<AdminBooking>((_resolve, reject) => {
          release = () => reject(new RepositoryError("Network error"));
        }),
    );
    renderBoard(client);

    const confirm = (await screen.findByRole("button", { name: "Подтвердить" })) as HTMLButtonElement;
    fireEvent.click(confirm);

    await waitFor(() => expect(confirm.disabled).toBe(true));
    const reject = screen.getByRole("button", { name: "Отклонить" }) as HTMLButtonElement;
    expect(reject.disabled).toBe(true);

    fireEvent.click(confirm);
    fireEvent.click(reject);
    expect(client.confirmBooking).toHaveBeenCalledTimes(1);
    expect(client.rejectBooking).not.toHaveBeenCalled();

    release?.();
    await screen.findByRole("alert");
  });

  it("re-reads the day after a successful answer instead of patching the row", async () => {
    const data = view({ awaiting: [row()], awaiting_total: 1, today: [], today_total: 0, guests: 0 });
    const client = clientReturning(data, async () => ({}) as AdminBooking);
    renderBoard(client);

    fireEvent.click(await screen.findByRole("button", { name: "Подтвердить" }));

    // The counters below («N броней · M гостей») are computed server-side over
    // the whole day, so the only correct refresh is a re-read.
    await waitFor(() => expect(client.venueDashboardToday).toHaveBeenCalledTimes(2));
  });
});
