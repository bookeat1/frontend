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

/**
 * What the flow was asked to pre-select when the guest entered it — today that
 * is a red time pill on an Explore card, which links to
 * `/restaurant/:id/book?date=…&startsAt=…&guests=…`.
 *
 * Only `date` and `guests` can be applied immediately. The TIME cannot: a slot
 * is an object that only exists once availability has been loaded, and the one
 * the guest tapped may already be gone by the time this screen asks. So the
 * start time is held as an intent and resolved against the real answer.
 */
export interface BookingPrefill {
  /** "YYYY-MM-DD" in the device's local calendar. */
  date?: string;
  /** A string when it comes straight off the route's query params. */
  guests?: string | number;
  /** RFC3339 start of the slot the guest tapped. */
  startsAt?: string;
}

/**
 * How the time part of the prefill ended up:
 *   none    — nothing was asked for (the guest opened the flow normally);
 *   pending — asked for, availability hasn't answered yet;
 *   applied — the slot exists, is free, and is now selected;
 *   taken   — it is gone (or the venue no longer offers it). The date and the
 *             party size stay, and the guest is TOLD, because the alternative
 *             is silently booking a different time than the one they tapped.
 */
export type PrefillOutcome = "none" | "pending" | "applied" | "taken";

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
  /** See PrefillOutcome. */
  prefillOutcome: PrefillOutcome;
  /**
   * Hands the day's real slots to the draft so a pending time prefill can be
   * settled. Safe to call on every availability answer: it does nothing once
   * the prefill is no longer pending.
   */
  resolvePrefill(slots: AvailabilitySlot[]): void;
}

const BookingDraftContext = createContext<BookingDraftValue | null>(null);

/** Not a cryptographic id — it only has to be unique per device per attempt.
 * `crypto.randomUUID` is not available on every Hermes build Expo ships. */
function randomKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Party size the flow starts on when nothing else is asked for. */
const DEFAULT_GUESTS = 2;

/** "YYYY-MM-DD", and a date the flow could actually book (today .. horizon). */
function sanitizeDate(raw: string | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) return null;
  const horizon = addDays(today, HORIZON_DAYS);
  if (parsed > horizon) return null;
  return raw;
}

function sanitizeGuests(raw: string | number | undefined): number | null {
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  if (value === undefined || value === null || !Number.isFinite(value)) return null;
  if (value < MIN_GUESTS || value > MAX_GUESTS) return null;
  return value;
}

function sanitizeStartsAt(raw: string | undefined): string | null {
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  // A slot in the past is not something the guest can be walked into.
  if (parsed < Date.now()) return null;
  return raw;
}

export function BookingDraftProvider({
  restaurantId,
  prefill,
  children,
}: {
  restaurantId: string;
  /** Read from the route's query params by the flow's layout. Every field is
   * validated here rather than trusted: these arrive from a URL. */
  prefill?: BookingPrefill;
  children: React.ReactNode;
}) {
  // Read ONCE, at mount (lazy initializer, so the validators don't re-run on
  // every render). A later re-render of the layout with the same params must
  // not reset a form the guest has already been editing.
  const [initial] = useState(() => ({
    date: sanitizeDate(prefill?.date),
    guests: sanitizeGuests(prefill?.guests),
    startsAt: sanitizeStartsAt(prefill?.startsAt),
  }));

  const [date, setDateState] = useState(() => initial.date ?? toDateKey(new Date()));
  const [guests, setGuestsState] = useState(() => initial.guests ?? DEFAULT_GUESTS);
  const [slot, setSlotState] = useState<AvailabilitySlot | null>(null);
  // The tapped start time, still unproven. A ref, not state: nothing renders
  // from it, and settling it must not run inside a state updater (React runs
  // updaters twice under StrictMode, and this one has side effects).
  const pendingStartsAt = useRef<string | null>(initial.startsAt);
  // The time that WAS applied from the prefill and the guest has not touched
  // since. Kept so a fresher availability answer can take it back if the slot
  // has gone in the meantime — the guest never picked it by hand, so they have
  // no reason to suspect it is stale.
  const appliedStartsAt = useRef<string | null>(null);
  const [prefillOutcome, setPrefillOutcome] = useState<PrefillOutcome>(
    initial.startsAt ? "pending" : "none",
  );
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

  /** The guest took over: whatever time was pre-selected for them is void. */
  const cancelPrefill = useCallback(() => {
    pendingStartsAt.current = null;
    appliedStartsAt.current = null;
    setPrefillOutcome("none");
  }, []);

  const setDate = useCallback(
    (next: string) => {
      setDateState(next);
      // The old slot belonged to the old day; keeping it would submit a time
      // the guest can no longer see on screen.
      setSlotState(null);
      cancelPrefill();
      rotateKeyFor(`${restaurantId}|${next}|${guests}|`);
    },
    [cancelPrefill, guests, restaurantId, rotateKeyFor],
  );

  const setGuests = useCallback(
    (next: number) => {
      const clamped = Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, next));
      setGuestsState(clamped);
      // Availability is computed per party size: a slot that fit 2 may not fit
      // 8, so the choice has to be made again against the new numbers.
      setSlotState(null);
      cancelPrefill();
      rotateKeyFor(`${restaurantId}|${date}|${clamped}|`);
    },
    [cancelPrefill, date, restaurantId, rotateKeyFor],
  );

  /**
   * Settles the pending time against the day's REAL slots, and afterwards
   * keeps watching it.
   *
   * A slot counts only when the server both knows it and calls it available —
   * `available === false` covers "occupied", "capacity" and "too_soon" alike,
   * and every one of them means the guest cannot have that time. Anything else
   * would book them into a different time than the one they tapped.
   *
   * The second phase matters because the first answer can come from the cache
   * the Explore screen filled a minute ago: when the refetch says the slot is
   * gone, the pre-selected time is TAKEN BACK rather than left sitting in the
   * form waiting to fail with a 409 at submit time.
   */
  const resolvePrefill = useCallback(
    (slots: AvailabilitySlot[]) => {
      const wanted = pendingStartsAt.current;
      if (wanted) {
        pendingStartsAt.current = null;
        const match = slots.find((s) => s.startsAt === wanted && s.available);
        if (!match) {
          setPrefillOutcome("taken");
          return;
        }
        appliedStartsAt.current = match.startsAt;
        setSlotState(match);
        setPrefillOutcome("applied");
        // Same bookkeeping setSlot does: the key must follow the body.
        keyedOn.current = `${restaurantId}|${date}|${guests}|${match.startsAt}`;
        setIdempotencyKey(randomKey());
        return;
      }

      const applied = appliedStartsAt.current;
      if (!applied) return;
      if (slots.some((s) => s.startsAt === applied && s.available)) return;
      appliedStartsAt.current = null;
      setSlotState(null);
      setPrefillOutcome("taken");
      keyedOn.current = `${restaurantId}|${date}|${guests}|`;
      setIdempotencyKey(randomKey());
    },
    [date, guests, restaurantId],
  );

  const setSlot = useCallback(
    (next: AvailabilitySlot | null) => {
      setSlotState(next);
      // Picking a time by hand answers the prefill question, whatever it was:
      // the "your time was taken" notice has served its purpose.
      cancelPrefill();
      rotateKeyFor(`${restaurantId}|${date}|${guests}|${next?.startsAt ?? ""}`);
    },
    [cancelPrefill, date, guests, restaurantId, rotateKeyFor],
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
      prefillOutcome,
      resolvePrefill,
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
      prefillOutcome,
      resolvePrefill,
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
