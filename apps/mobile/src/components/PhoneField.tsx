import { colors, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  flagEmoji,
  nationalLength,
  type Country,
} from "../lib/countries";
import {
  emptyPhone,
  formatNational,
  isPhoneComplete,
  parsePhoneInput,
  phoneFromE164,
  toE164,
  type PhoneValue,
} from "../lib/phone";
import { CaretDown, MagnifyingGlass, X } from "./icons";

const t = getDictionary();
const copy = t.phoneField;

/**
 * "(000) 000-00-00" for a country we have a format for, a neutral hint for one
 * we do not. Built from the country's own grouping so the example can never
 * contradict what the mask will actually do.
 */
function placeholderFor(country: Country): string {
  const length = nationalLength(country);
  if (length === undefined) return copy.placeholder;
  return formatNational("0".repeat(length), country);
}

/**
 * The one phone input in the app: a country selector on the left, the national
 * number on the right.
 *
 *     🇰🇿 +7 ▾ │ (701) 234-56-78
 *
 * WHY IT IS SPLIT IN TWO. The country code is not text the guest edits — it is
 * a choice they make. Drawing it inside the input is what produced the three
 * different behaviours this component replaces: a caret that can be put before
 * the "+", a "+7" that can be backspaced away, and a mask that has to decide on
 * every keystroke whether the leading digits are a country code or the start of
 * a local number. With the code in a button none of those questions exist.
 *
 * WHAT THE CALLER GETS is E.164 ("+77012345678") or "" — never a half-formatted
 * display string, never "+7" on its own. `complete` is reported alongside it so
 * a screen can disable its submit without re-deriving the rule.
 *
 * WHAT THE CALLER MUST NOT DO is treat this as a fully controlled input. `value`
 * seeds the field (a prefill from the account, a restored draft) and is
 * re-applied only when it names a different number from the one on screen —
 * otherwise a parent that echoes the value back would fight the guest's typing
 * and reset their country the moment they cleared the digits.
 */
export function PhoneField({
  label,
  value,
  onChange,
  error,
  hint,
  editable = true,
  autoFocus = false,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  /** E.164, or "" for an empty field. */
  value: string;
  onChange: (next: { e164: string; complete: boolean }) => void;
  error?: string;
  hint?: string;
  editable?: boolean;
  autoFocus?: boolean;
  returnKeyType?: "go" | "done" | "next";
  onSubmitEditing?: () => void;
}) {
  const errorId = useId();
  const [phone, setPhone] = useState<PhoneValue>(() => phoneFromE164(value) ?? emptyPhone());
  const [pickerOpen, setPickerOpen] = useState(false);

  // What is actually rendered in the input right now. Kept in a ref because the
  // deletion rule below has to know what the guest was looking at when they hit
  // backspace, and a re-render must not be needed to find out.
  const shown = formatNational(phone.national, phone.country);
  const lastShown = useRef(shown);
  lastShown.current = shown;

  // Re-seed from the outside ONLY when the parent names a different number.
  // `toE164` of the current state is compared, not the raw prop, so an echo of
  // what we just emitted is a no-op.
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

  /**
   * Every edit lands here — one character, a paste, or a select-all-and-retype.
   * There is no branch for "this was a paste": `parsePhoneInput` gives the same
   * answer for "7" as for "+7 701 234 56 78", so nothing has to be guessed.
   *
   * The one case the parser cannot see is a backspace that landed on a
   * SEPARATOR. React Native hands us the text after the deletion, and if the
   * character removed was a bracket or a dash the digits are unchanged — so the
   * field would re-render identically and the guest's backspace would do
   * nothing at all. That is the single most infuriating bug a masked input can
   * have, so it is handled explicitly: find where the strings diverge and drop
   * the digit in front of the separator that went, which is what the guest was
   * aiming at. It works mid-string, not only at the end.
   */
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
      // The digits stay. Someone who picked the wrong country and fixed it
      // should not have to retype their number; the mask simply re-groups what
      // is already there (and trims it if the new country holds fewer digits).
      commit(parsePhoneInput(phone.national, country));
    },
    [commit, phone.national],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.row, Boolean(error) && styles.rowError]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.countryButtonLabel(phone.country.name, phone.country.dial)}
          accessibilityState={{ disabled: !editable, expanded: pickerOpen }}
          disabled={!editable}
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.countryButton, pressed && styles.pressed]}
        >
          {/* The flag is decoration: the button's own label already says the
              country by name, so a screen reader must not also spell out two
              regional-indicator characters. */}
          <Text style={styles.flag} importantForAccessibility="no">
            {flagEmoji(phone.country.iso2)}
          </Text>
          <Text style={styles.dial}>{`+${phone.country.dial}`}</Text>
          <CaretDown size={14} color={colors.text.mutedStrong} weight="bold" />
        </Pressable>

        <View style={styles.divider} />

        <TextInput
          style={styles.input}
          value={shown}
          onChangeText={handleChangeText}
          // The placeholder is the country's OWN shape, derived from the same
          // grouping the mask uses, so it can never drift from it.
          placeholder={placeholderFor(phone.country)}
          placeholderTextColor={colors.text.muted}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          editable={editable}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          // NO maxLength. The mask is what bounds the digits; a character cap
          // here would silently truncate a pasted "+1 212 555 1234" before the
          // parser ever saw its country code.
          accessibilityLabel={label}
          accessibilityState={{ disabled: !editable }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      </View>

      {error ? (
        <Text nativeID={errorId} style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
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

/**
 * The selector's list. A `FlatList`, not a `ScrollView`: this is 200-odd rows
 * and mounting them all to show eight would cost a visible freeze on the cheap
 * Android the app has to run on.
 *
 * Search matches the Russian name AND the dial code, because both are things a
 * guest knows about their own country — «Герм» and «49» must both find Germany.
 */
function CountryPicker({
  visible,
  selected,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  selected: Country;
  onSelect: (country: Country) => void;
  onDismiss: () => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.startsWith(q) || c.iso2.toLowerCase() === q,
    );
  }, [query]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.pickerRoot}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.pickerBackdrop]}
          onPress={onDismiss}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View style={styles.pickerSheet} accessibilityViewIsModal>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle} accessibilityRole="header">
              {copy.pickerTitle}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.pickerClose}
              onPress={onDismiss}
              style={styles.pickerCloseButton}
            >
              <X size={20} color={colors.text.primary} weight="bold" />
            </Pressable>
          </View>

          <View style={styles.search}>
            <MagnifyingGlass size={18} color={colors.text.muted} weight="bold" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={copy.pickerSearchPlaceholder}
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={copy.pickerSearchPlaceholder}
            />
          </View>

          {results.length === 0 ? (
            <Text style={styles.pickerEmpty}>{copy.pickerEmpty}</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(c) => c.iso2}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              windowSize={7}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.iso2 === selected.iso2 }}
                  accessibilityLabel={copy.countryRowLabel(item.name, item.dial)}
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [styles.countryRow, pressed && styles.pressed]}
                >
                  <Text style={styles.flag} importantForAccessibility="no">
                    {flagEmoji(item.iso2)}
                  </Text>
                  {/* The name takes the free space and wraps rather than
                      truncating: «Босния и Герцеговина» does not fit one line
                      at 360px, and a country the guest cannot read the name of
                      is a country they cannot pick. */}
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryDial}>{`+${item.dial}`}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Re-exported so a screen can start from the same default the field does. */
export { DEFAULT_COUNTRY };

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: hitSlop.minTouchTarget,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowError: {
    borderColor: colors.brand.primary,
  },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: hitSlop.minTouchTarget,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  flag: {
    fontSize: 20,
  },
  dial: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: spacing.sm,
    backgroundColor: colors.text.muted,
  },
  input: {
    flex: 1,
    minHeight: hitSlop.minTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  error: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  hint: {
    ...typography.caption,
    color: colors.text.muted,
  },
  pickerRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerBackdrop: {
    backgroundColor: colors.overlay.dialogScrim,
  },
  pickerSheet: {
    // Not full height: the sheet is reachable one-handed, and the number the
    // guest was typing stays visible above it.
    maxHeight: "80%",
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  pickerTitle: {
    ...typography.titleCard,
    color: colors.text.primary,
    flexShrink: 1,
  },
  pickerCloseButton: {
    width: hitSlop.minTouchTarget,
    height: hitSlop.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: hitSlop.minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chipAlt,
  },
  searchInput: {
    flex: 1,
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  pickerEmpty: {
    ...typography.caption,
    color: colors.text.muted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: hitSlop.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  countryName: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  countryDial: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
  },
});
