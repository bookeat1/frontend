import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RepositoryError } from "@bookeat/api";
import type { BookingPolicy, BookingPolicyPatch } from "@bookeat/api/admin";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { CapacityModeCard, type CapacityPolicyClient } from "../CapacityModeCard";

/**
 * REGRESSION GUARD — the venue cabinet used to be unable to say WHY a capacity
 * mode switch was refused.
 *
 * PATCH /restaurants/:id/booking-policy answers 409 for a lost race and 422 for
 * "your own data does not allow it", and the human text on the wire is the same
 * generic English string for every 409 ("already exists") and every 422
 * ("validation failed") — response.classify builds it from the sentinel alone.
 * So a staff member who lost a race by half a second was shown «уже существует»,
 * which is meaningless about their venue and hides the one thing that works:
 * pressing the button again. And a venue with 400 live bookings was shown the
 * same sentence, while for THEM pressing again can never work.
 *
 * What breaks for a real person if this regresses: either a mode switch that
 * would have succeeded on the second press is abandoned, or a manager sits
 * pressing a button that is refusing them for a permanent reason. Both end in
 * the same place — the venue keeps selling seats through the wrong engine.
 *
 * The two narrow codes come from domain.WithCode in
 * usecase/bookings/venue_policy.go. Everything the server does NOT label
 * narrowly must stay "we do not know", never "nothing happened".
 */

const RESTAURANT_ID = "r-1";

function policy(mode: "tables" | "seats", seats = 0): BookingPolicy {
  return {
    restaurant_id: RESTAURANT_ID,
    effective: {
      timezone: "Asia/Almaty",
      booking_duration_minutes: 90,
      booking_buffer_minutes: 15,
      booking_lead_minutes: 60,
      booking_horizon_days: 30,
      cancel_deadline_minutes: 120,
      confirm_sla_minutes: 30,
      max_guests_per_booking: 12,
      auto_confirm: true,
      capacity_mode: mode,
      capacity_seats: seats,
    },
    overrides: {
      timezone: null,
      booking_duration_minutes: null,
      booking_buffer_minutes: null,
      booking_lead_minutes: null,
      booking_horizon_days: null,
      cancel_deadline_minutes: null,
      confirm_sla_minutes: null,
      max_guests_per_booking: null,
      auto_confirm: null,
      booking_capacity_mode: mode,
      booking_capacity_seats: seats || null,
    },
  };
}

/** A client that always answers the same refusal, so the test asserts on the
 * wording the panel derives — not on how many requests it took. */
function clientRefusing(error: unknown): CapacityPolicyClient & {
  patches: BookingPolicyPatch[];
} {
  const patches: BookingPolicyPatch[] = [];
  return {
    patches,
    getBookingPolicy: vi.fn(async () => policy("tables")),
    updateBookingPolicy: vi.fn(async (_id: string, patch: BookingPolicyPatch) => {
      patches.push(patch);
      throw error;
    }),
  };
}

function renderCard(client: CapacityPolicyClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CapacityModeCard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

/** Loads the card (venue is in `tables` mode), asks for `seats` with a number,
 * and presses Save. The assertions read the screen afterwards.
 *
 * Plain `fireEvent` rather than user-event on purpose: user-event is only
 * present in node_modules as a transitive dependency of expo-router, and a test
 * suite must not rest on somebody else's dependency tree. */
async function switchToSeats(client: CapacityPolicyClient) {
  renderCard(client);
  const seatsMode = await screen.findByRole("radio", { name: /По общей вместимости/ });
  fireEvent.click(seatsMode);
  fireEvent.change(screen.getByLabelText(/Всего мест/), { target: { value: "80" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить режим" }));
}

/** The error shape the AdminApiClient really produces for an envelope with a
 * `code`. Built through RepositoryError so the test cannot pass on a field the
 * client never sets. */
function serverError(status: number, code?: string) {
  return new RepositoryError("server said no", undefined, status, "already exists", code);
}

describe("отказ переключения режима вместимости", () => {
  it("гонка с изменением брони: говорит, что ничего не изменилось, и даёт повторить", async () => {
    const client = clientRefusing(serverError(409, "capacity_switch_conflict"));
    await switchToSeats(client);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("Не успели: бронь меняли в этот же момент");
    expect(alert.textContent ?? "").toContain("Ничего не изменилось");

    // The point of the whole fix: a button, not "заполните форму заново".
    const retry = screen.getByRole("button", { name: "Повторить" });
    // And an unknown-outcome refresh must NOT be offered beside it — the server
    // told us nothing changed.
    expect(screen.queryByRole("button", { name: "Обновить данные" })).toBeNull();

    fireEvent.click(retry);
    await waitFor(() => expect(client.updateBookingPolicy).toHaveBeenCalledTimes(2));
    // The retry resends the SAME request, not an empty one.
    expect(client.updateBookingPolicy).toHaveBeenLastCalledWith(RESTAURANT_ID, {
      booking_capacity_mode: "seats",
      booking_capacity_seats: 80,
    });
  });

  it("слишком много активных броней: другой текст, и повторять не предлагает", async () => {
    const client = clientRefusing(serverError(422, "capacity_switch_too_many_bookings"));
    await switchToSeats(client);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("Слишком много активных броней");
    expect(alert.textContent ?? "").toContain("Повтор не поможет");
    expect(alert.textContent ?? "").toContain("300");
    // Neither wording of the other case may leak in here.
    expect(alert.textContent ?? "").not.toContain("Не успели");
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
  });

  it("два кода дают РАЗНЫЙ текст, а не один общий «уже существует»", async () => {
    const conflict = clientRefusing(serverError(409, "capacity_switch_conflict"));
    await switchToSeats(conflict);
    const conflictText = (await screen.findByRole("alert")).textContent ?? "";

    cleanup();

    const tooMany = clientRefusing(serverError(422, "capacity_switch_too_many_bookings"));
    await switchToSeats(tooMany);
    const tooManyText = (await screen.findByRole("alert")).textContent ?? "";

    expect(conflictText).not.toBe(tooManyText);
    // And neither of them is the server's own developer English.
    expect(conflictText).not.toContain("already exists");
    expect(tooManyText).not.toContain("already exists");
  });

  it("409 без кода (старый сервер): не утверждает, что ничего не изменилось", async () => {
    // A build older than 2026-07-25 sends the generic sentinel code, or none.
    const client = clientRefusing(serverError(409, "already_exists"));
    await switchToSeats(client);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("Неизвестно, применилось ли переключение");
    expect(alert.textContent ?? "").not.toContain("Ничего не изменилось");
    // No retry: re-sending a switch whose outcome we do not know is exactly
    // what must not be one click away.
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
    expect(screen.getByRole("button", { name: "Обновить данные" })).toBeTruthy();
  });

  it("обрыв связи: тоже «неизвестно», а не «не сохранилось»", async () => {
    // No status at all — the request may have reached the database.
    const client = clientRefusing(new RepositoryError("Network error requesting /booking-policy"));
    await switchToSeats(client);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("Неизвестно, применилось ли переключение");
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
  });

  it("422 без узкого кода: «данные заведения не позволяют», ничего не изменилось", async () => {
    // No active tables / seats not set / a booking does not fit — the server
    // never says which, so the wording lists the real causes instead of
    // pretending to know.
    const client = clientRefusing(serverError(422, "validation_failed"));
    await switchToSeats(client);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent ?? "").toContain("Переключение отклонено");
    expect(alert.textContent ?? "").toContain("Ничего не изменилось");
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Обновить данные" })).toBeNull();
  });
});
