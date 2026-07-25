import type { AvailabilitySlot, PreorderLineInput } from "@bookeat/api";
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { addDays, toDateKey } from "./format";

/**
 * The in-progress reservation, shared across the four screens of the flow
 * (reservation / date / guests / pre-order).
 *
 * It lives in a provider mounted by `app/restaurant/[id]/book/_layout.tsx`, so
 * it is created when the guest enters the flow and thrown away when they leave
 * it — no global store to leak a half-filled form of one venue into another.
 *
 * Nothing here is persisted: a draft that survives a cold start would restore
 * a time slot that has since been taken, which is worse than an empty form.
 */

/** The backend's default `max_guests_per_booking` (BOOKING_DEFAULT_MAX_GUESTS
 * = 20). A venue may lower it via its own booking policy, but that policy is
 * only readable by staff, so the client caps at the global default and lets
 * the server reject anything a particular venue won't take. */
export const MAX_GUESTS = 20;
export const MIN_GUESTS = 1;
/** BOOKING_DEFAULT_HORIZON_DAYS = 60. */
export const HORIZON_DAYS = 60;

export interface PreorderDraftLine extends PreorderLineInput {
  /** Kept alongside the id so the reservation screen can show a total and the
   * cart survives leaving the menu screen without refetching it. */
  name: string;
  priceMinor: number | null;
}

interface BookingDraft {
  restaurantId: string;
  /** "YYYY-MM-DD" in the device's local calendar. */
  date: string;
  guests: number;
  /** The chosen slot, or null until the guest picks a time. Held whole (not
   * just its start) so the confirmation can show the end time without
   * re-deriving the venue's slot duration. */
  slot: AvailabilitySlot | null;
  name: string;
  phone: string;
  notes: string;
  preorder: PreorderDraftLine[];
}

interface BookingDraftValue extends BookingDraft {
  setDate(date: string): void;
  setGuests(guests: number): void;
  setSlot(slot: AvailabilitySlot | null): void;
  setName(name: string): void;
  setPhone(phone: string): void;
  setNotes(notes: string): void;
  setPreorderQuantity(line: Omit<PreorderDraftLine, "quantity">, quantity: number): void;
  clearPreorder(): void;
  /** Prefills name/phone from the signed-in account WITHOUT clobbering
   * anything the guest already typed. */
  prefillContact(input: { name?: string | null; phone?: string | null }): void;
  /**
   * A stable Idempotency-Key for this draft. Regenerated only when the
   * booking's identity actually changes (venue / time / guests), so a retry
   * after a timeout reuses the key and the backend returns the ORIGINAL
   * booking instead of creating a second one.
   */
  idempotencyKey: string;
  maxDate: Date;
}

const BookingDraftContext = createContext<BookingDraftValue | null>(null);

/** Not a cryptographic id — it only has to be unique per device per attempt.
 * `crypto.randomUUID` is not available on every Hermes build Expo ships. */
function randomKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function BookingDraftProvider({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: React.ReactNode;
}) {
  const [date, setDateState] = useState(() => toDateKey(new Date()));
  const [guests, setGuestsState] = useState(2);
  const [slot, setSlotState] = useState<AvailabilitySlot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [preorder, setPreorder] = useState<PreorderDraftLine[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(randomKey);

  // Which draft the current key belongs to. Compared as a ref rather than
  // inside a state updater because updaters must stay pure (StrictMode runs
  // them twice) — the same rule the admin panel's restaurant switch follows.
  const keyedOn = useRef(`${restaurantId}|${date}|${guests}|`);

  // The key must cover EVERYTHING the request body carries, not just the venue,
  // day, party and slot. The backend answers 409 "already exists" when the same
  // key arrives with a DIFFERENT body — so a guest who fixed a typo in their
  // phone after a timed-out submit got a conflict, which the screen then read as
  // "your time was taken". They picked another time, the key rotated, and they
  // ended up with two confirmed bookings while believing they had none.
  // Contact details therefore rotate the key too: a changed body is a new
  // request, and the server never has to guess which of the two we meant.
  const contactSignature = useCallback(
    (nextName: string, nextPhone: string, nextNotes: string) =>
      `${nextName.trim()}|${nextPhone.trim()}|${nextNotes.trim()}`,
    [],
  );

  const rotateKeyFor = useCallback((signature: string) => {
    if (keyedOn.current === signature) return;
    keyedOn.current = signature;
    setIdempotencyKey(randomKey());
  }, []);

  const setDate = useCallback(
    (next: string) => {
      setDateState(next);
      // The old slot belonged to the old day; keeping it would submit a time
      // the guest can no longer see on screen.
      setSlotState(null);
      rotateKeyFor(`${restaurantId}|${next}|${guests}|`);
    },
    [guests, restaurantId, rotateKeyFor],
  );

  const setGuests = useCallback(
    (next: number) => {
      const clamped = Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, next));
      setGuestsState(clamped);
      // Availability is computed per party size: a slot that fit 2 may not fit
      // 8, so the choice has to be made again against the new numbers.
      setSlotState(null);
      rotateKeyFor(`${restaurantId}|${date}|${clamped}|`);
    },
    [date, restaurantId, rotateKeyFor],
  );

  const setSlot = useCallback(
    (next: AvailabilitySlot | null) => {
      setSlotState(next);
      rotateKeyFor(`${restaurantId}|${date}|${guests}|${next?.startsAt ?? ""}`);
    },
    [date, guests, restaurantId, rotateKeyFor],
  );

  const setPreorderQuantity = useCallback(
    (line: Omit<PreorderDraftLine, "quantity">, quantity: number) => {
      setPreorder((current) => {
        const rest = current.filter((item) => item.menuItemId !== line.menuItemId);
        if (quantity <= 0) return rest;
        return [...rest, { ...line, quantity }];
      });
    },
    [],
  );

  const clearPreorder = useCallback(() => setPreorder([]), []);

  const prefillContact = useCallback((input: { name?: string | null; phone?: string | null }) => {
    // Only fills empty fields: the guest may be booking for someone else, and
    // overwriting what they typed the moment /users/me answers would be a bug
    // they'd notice mid-sentence.
    if (input.name) setName((current) => (current.trim() ? current : input.name!));
    if (input.phone) setPhone((current) => (current.trim() ? current : input.phone!));
  }, []);

  const maxDate = useMemo(() => addDays(new Date(), HORIZON_DAYS), []);

  // Wrapped setters: the raw state setters are kept private so nothing can
  // change the body without the key following it.
  const setNameKeyed = useCallback(
    (next: string) => {
      setName(next);
      rotateKeyFor(`${restaurantId}|${date}|${guests}|${slot?.startsAt ?? ""}|${contactSignature(next, phone, notes)}`);
    },
    [contactSignature, date, guests, notes, phone, restaurantId, rotateKeyFor, slot],
  );

  const setPhoneKeyed = useCallback(
    (next: string) => {
      setPhone(next);
      rotateKeyFor(`${restaurantId}|${date}|${guests}|${slot?.startsAt ?? ""}|${contactSignature(name, next, notes)}`);
    },
    [contactSignature, date, guests, name, notes, restaurantId, rotateKeyFor, slot],
  );

  const setNotesKeyed = useCallback(
    (next: string) => {
      setNotes(next);
      rotateKeyFor(`${restaurantId}|${date}|${guests}|${slot?.startsAt ?? ""}|${contactSignature(name, phone, next)}`);
    },
    [contactSignature, date, guests, name, phone, restaurantId, rotateKeyFor, slot],
  );

  const value = useMemo<BookingDraftValue>(
    () => ({
      restaurantId,
      date,
      guests,
      slot,
      name,
      phone,
      notes,
      preorder,
      idempotencyKey,
      maxDate,
      setDate,
      setGuests,
      setSlot,
      setName: setNameKeyed,
      setPhone: setPhoneKeyed,
      setNotes: setNotesKeyed,
      setPreorderQuantity,
      clearPreorder,
      prefillContact,
    }),
    [
      restaurantId,
      date,
      guests,
      slot,
      name,
      phone,
      notes,
      preorder,
      idempotencyKey,
      maxDate,
      setDate,
      setGuests,
      setSlot,
      setNameKeyed,
      setPhoneKeyed,
      setNotesKeyed,
      setPreorderQuantity,
      clearPreorder,
      prefillContact,
    ],
  );

  return <BookingDraftContext.Provider value={value}>{children}</BookingDraftContext.Provider>;
}

export function useBookingDraft(): BookingDraftValue {
  const value = useContext(BookingDraftContext);
  if (!value) {
    throw new Error("useBookingDraft must be used within a BookingDraftProvider");
  }
  return value;
}

/** Client-side total of the pre-order cart, in minor units. Undefined when any
 * chosen dish has no price — the screen then says so instead of quoting a
 * total that silently omits a dish. */
export function estimatePreorderTotalMinor(lines: PreorderDraftLine[]): number | undefined {
  let total = 0;
  for (const line of lines) {
    if (line.priceMinor === null) return undefined;
    total += line.priceMinor * line.quantity;
  }
  return total;
}
