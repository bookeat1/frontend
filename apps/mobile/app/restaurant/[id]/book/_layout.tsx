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
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <BookingDraftProvider restaurantId={id ?? ""}>
      <Stack screenOptions={{ headerShown: false }} />
    </BookingDraftProvider>
  );
}
