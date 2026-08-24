import type { BookingStatus } from "@bookeat/api";
import { colors, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { BookingCard } from "./BookingCard";

const t = getDictionary();

/**
 * "Что дальше?" (Figma node 488:9876 — в макете заголовок длиннее, укорочен
 * по правке владельца 2026-08-24).
 *
 * NOTE ON THE MOCKUP: both exported frames show the SAME paragraph — "the
 * restaurant usually confirms reservations within 15–30 minutes, we'll notify
 * you" — including the one whose pill already reads "Confirmed". Read
 * literally that would tell a guest whose table is already held that the venue
 * still has to answer. That is a copy-paste artifact of the mockup, not
 * intent, so the copy here is per-status: the pending text appears only on
 * pending/waitlist.
 */
export function WhatHappensNextCard({ status }: { status: BookingStatus }) {
  return (
    <BookingCard title={t.booking.whatHappensNextTitle}>
      <Text style={styles.body}>{t.booking.whatHappensNext[status]}</Text>
    </BookingCard>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.text.mutedStrong,
  },
});
