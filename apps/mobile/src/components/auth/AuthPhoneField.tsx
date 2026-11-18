import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DEFAULT_COUNTRY, guessCountryByIp, type Country } from "../../lib/countries";
import {
  emptyPhone,
  formatNational,
  isPhoneComplete,
  parsePhoneInput,
  phoneFromE164,
  toE164,
  type PhoneValue,
} from "../../lib/phone";
import { CaretDown } from "../icons";
import { CountryPicker } from "../PhoneField";

const copy = getDictionary().phoneField;

/**
 * The sign-in phone input, following the registration design (Figma node
 * 997:10239): a single flat pill with the dial code and the national number
 * beside it — no flag, no field label.
 *
 * ONE DEPARTURE FROM THE DESIGN: the dial code is a button. The design draws a
 * fixed "+7"; a guest with a foreign number could not sign in at all, so the
 * code now opens the same country list `PhoneField` uses (alphabetical by
 * country name), and an empty field starts on the country guessed from the
 * guest's IP, falling back to Kazakhstan.
 *
 * WHY STILL A DEDICATED COMPONENT, not the shared `PhoneField`: that one has a
 * label, a flag and a divider, and reusing it here is exactly what made the
 * screen read as "the old one". The contract to the screen is identical —
 * `onChange({ e164, complete })` — and parsing/formatting are the same
 * `lib/phone` primitives, so paste and mid-string deletion behave the same.
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
  const [pickerOpen, setPickerOpen] = useState(false);

  // The country of an EMPTY field is a guess from the guest's IP. It never
  // overrides a seeded number, a country the guest picked, or digits already
  // typed — and when the lookup fails the default (Kazakhstan) simply stays.
  const decided = useRef(phone.national !== "");
  useEffect(() => {
    if (decided.current) return;
    let alive = true;
    void guessCountryByIp().then((country) => {
      if (!alive || !country || decided.current) return;
      setPhone((current) => (current.national === "" ? emptyPhone(country) : current));
    });
    return () => {
      alive = false;
    };
  }, []);

  const shown = formatNational(phone.national, phone.country);
  const lastShown = useRef(shown);
  lastShown.current = shown;

  // Re-seed only when the parent names a different number (a prefill / restore),
  // never on an echo of what we just emitted — same guard as PhoneField.
  const lastEmitted = useRef(toE164(phone));
  if (value !== lastEmitted.current) {
    lastEmitted.current = value;
    const seeded = phoneFromE164(value) ?? emptyPhone(phone.country);
    if (toE164(seeded) !== toE164(phone)) {
      if (seeded.national !== "") decided.current = true;
      setPhone(seeded);
    }
  }

  const commit = useCallback(
    (next: PhoneValue) => {
      decided.current = true;
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

  const chooseCountry = useCallback(
    (country: Country) => {
      setPickerOpen(false);
      // The digits stay; the mask re-groups them for the new country.
      commit(parsePhoneInput(phone.national, country));
    },
    [commit, phone.national],
  );

  const hasDigits = phone.national.length > 0;

  return (
    <View style={styles.root}>
      <View style={[styles.field, Boolean(error) && styles.fieldError]}>
        {/* The dial code opens the country list. Muted until the guest starts
            typing, so an empty field still reads as a grey "+7". */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.countryButtonLabel(phone.country.name, phone.country.dial)}
          accessibilityState={{ disabled: !editable, expanded: pickerOpen }}
          disabled={!editable}
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.prefixButton, pressed && styles.pressed]}
        >
          <Text style={[styles.prefix, hasDigits && styles.prefixActive]}>
            {`+${phone.country.dial}`}
          </Text>
          <CaretDown
            size={14}
            color={hasDigits ? colors.text.primary : colors.text.muted}
            weight="bold"
          />
        </Pressable>
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

      <CountryPicker
        visible={pickerOpen}
        selected={phone.country}
        onSelect={chooseCountry}
        onDismiss={() => setPickerOpen(false)}
      />
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
  prefixButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: controlHeight.pill,
  },
  pressed: {
    opacity: 0.6,
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
