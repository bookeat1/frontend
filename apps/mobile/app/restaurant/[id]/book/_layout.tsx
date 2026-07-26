import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { BookingDraftProvider } from "../../../../src/lib/booking-draft";

/**
 * Owns the reservation draft for one venue. Mounting the provider on the
 * flow's layout (rather than globally) means the draft is created when the
 * guest enters the flow and discarded when they leave it — a half-filled form
 * can never leak from one restaurant into another.
 */
export default function BookingFlowLayout() {
  // `date` / `startsAt` / `guests` arrive when the guest entered the flow by
  // tapping a time pill on an Explore card. They are read HERE, on the layout
  // that owns the draft, so the draft is born pre-filled instead of the
  // reservation screen having to push values into it after its first render
  // (which is how the guest ended up re-picking a time they had chosen).
  //
  // Nothing is trusted: BookingDraftProvider validates all three (see
  // sanitizeDate / sanitizeGuests / sanitizeStartsAt) because these come from
  // a URL and a stale link is the normal case, not the exception.
  const { id, date, startsAt, guests } = useLocalSearchParams<{
    id: string;
    date?: string;
    startsAt?: string;
    guests?: string;
  }>();

  return (
    <BookingDraftProvider restaurantId={id ?? ""} prefill={{ date, startsAt, guests }}>
      <Stack screenOptions={{ headerShown: false }} />
    </BookingDraftProvider>
  );
}
