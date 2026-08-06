import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useCallback, useId, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { DEFAULT_COUNTRY } from "../../lib/countries";
import {
  emptyPhone,
  formatNational,
  isPhoneComplete,
  parsePhoneInput,
  phoneFromE164,
  toE164,
  type PhoneValue,
} from "../../lib/phone";

/**
 * The sign-in phone input, drawn 1:1 to the registration design (Figma node
 * 997:10239): a single flat pill with a fixed "+7" prefix and the national
 * number beside it — no flag, no country dropdown, no field label.
 *
 * WHY A DEDICATED COMPONENT, not the shared `PhoneField`. `PhoneField` carries
 * a country selector (flag + «▾») because screens that create an account from a
 * pasted foreign number need it; the registration design deliberately does not,
 * and reusing it here is exactly what made the screen read as "the old one".
 * The account is still created by whatever leaves in E.164, so the contract to
 * the screen is identical — `onChange({ e164, complete })` — only the country is
 * pinned to Kazakhstan and the chrome is gone.
 *
 * The parsing/formatting and the backspace-on-a-separator fix are the same
 * `lib/phone` primitives `PhoneField` uses, so paste and mid-string deletion
 * behave the same; only the country is fixed.
 */
export function AuthPhoneField({
  value,
  onChange,
  error,
  editable = true,
  autoFocus = false,
  returnKeyType,
  onSubmitEditing,
  accessibilityLabel,
}: {
  /** E.164, or "" for an empty field. */
  value: string;
  onChange: (next: { e164: string; complete: boolean }) => void;
  error?: string;
  editable?: boolean;
  autoFocus?: boolean;
  returnKeyType?: "go" | "done" | "next";
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
}) {
  const errorId = useId();
  const [phone, setPhone] = useState<PhoneValue>(
    () => phoneFromE164(value) ?? emptyPhone(DEFAULT_COUNTRY),
  );

  const shown = formatNational(phone.national, phone.country);
  const lastShown = useRef(shown);
  lastShown.current = shown;

  // Re-seed only when the parent names a different number (a prefill / restore),
  // never on an echo of what we just emitted — same guard as PhoneField.
  const lastEmitted = useRef(toE164(phone));
  if (value !== lastEmitted.current) {
    lastEmitted.current = value;
    const seeded = phoneFromE164(value) ?? emptyPhone(phone.country);
    if (toE164(seeded) !== toE164(phone)) setPhone(seeded);
  }

  const commit = useCallback(
    (next: PhoneValue) => {
      setPhone(next);
      const e164 = toE164(next);
      lastEmitted.current = e164;
      onChange({ e164, complete: next.national !== "" && isPhoneComplete(next) });
    },
    [onChange],
  );

  // Every edit lands here. `parsePhoneInput` handles one char and a full paste
  // identically; the one case it cannot see is a backspace that removed a
  // SEPARATOR (bracket/space/dash) — the digits are unchanged, so without this
  // the guest's backspace would do nothing. Find where the strings diverge and
  // drop the digit in front of the separator that went.
  const handleChangeText = useCallback(
    (raw: string) => {
      const prev = lastShown.current;
      const digitsOf = (s: string) => s.replace(/\D/g, "");

      if (raw.length === prev.length - 1 && digitsOf(raw) === phone.national) {
        let i = 0;
        while (i < raw.length && raw[i] === prev[i]) i += 1;
        const digitsBefore = digitsOf(prev.slice(0, i)).length;
        if (digitsBefore > 0) {
          commit({
            ...phone,
            national:
              phone.national.slice(0, digitsBefore - 1) + phone.national.slice(digitsBefore),
          });
          return;
        }
      }

      commit(parsePhoneInput(raw, phone.country));
    },
    [commit, phone],
  );

  const hasDigits = phone.national.length > 0;

  return (
    <View style={styles.root}>
      <View style={[styles.field, Boolean(error) && styles.fieldError]}>
        {/* Fixed country code — static text, not a control. Muted until the
            guest starts typing, so an empty field reads as a grey "+7". */}
        <Text style={[styles.prefix, hasDigits && styles.prefixActive]}>
          {`+${phone.country.dial}`}
        </Text>
        <TextInput
          style={styles.input}
          value={shown}
          onChangeText={handleChangeText}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          editable={editable}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: !editable }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      </View>

      {error ? (
        <Text nativeID={errorId} style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: controlHeight.pill,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    borderWidth: 1,
    borderColor: "transparent",
  },
  fieldError: {
    borderColor: colors.brand.primary,
  },
  prefix: {
    ...typography.labelMedium,
    color: colors.text.muted,
  },
  prefixActive: {
    color: colors.text.primary,
  },
  input: {
    flex: 1,
    minHeight: controlHeight.pill,
    paddingVertical: spacing.md,
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  error: {
    ...typography.caption,
    color: colors.brand.primary,
  },
});
