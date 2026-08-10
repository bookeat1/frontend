import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

/**
 * The segmented one-time-code input on the sign-in screen (Figma node
 * 997:10239, code step): N separate cells, one digit each, with a caret in the
 * next empty cell while focused.
 *
 * WHY ONE HIDDEN INPUT, NOT N INPUTS. A cell-per-TextInput design has to chase
 * focus between fields on every keystroke and on backspace, and it fights the
 * OS SMS autofill, which delivers the whole code at once to a single field.
 * Here a single real TextInput sits invisibly over the whole row, owns the
 * value and the keyboard, and the cells are pure presentation driven by
 * `value` — so paste, SMS autofill and one-digit typing all just work, and the
 * caller keeps the exact same `value`/`onChange(digits)` contract a plain field
 * would have.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  editable = true,
  error = false,
  accessibilityLabel,
}: {
  /** The digits entered so far ("" … up to `length`). */
  value: string;
  /** Emits the digits-only value, already capped at `length`. */
  onChange: (digits: string) => void;
  length?: number;
  autoFocus?: boolean;
  editable?: boolean;
  /** Paints every cell in the brand colour to flag a rejected code. */
  error?: boolean;
  accessibilityLabel?: string;
}) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const focus = () => inputRef.current?.focus();

  return (
    <Pressable
      onPress={focus}
      // The row is a tap-to-focus surface only. Marking it non-accessible keeps
      // it from swallowing its children into one opaque node, so the hidden
      // TextInput below is exposed to VoiceOver/TalkBack with its own label
      // (the cells themselves are decorative and stay hidden from the tree).
      accessible={false}
      style={styles.row}
    >
      {Array.from({ length }).map((_, i) => {
        const char = value[i] ?? "";
        // The active cell is the one the next digit will land in — the first
        // empty cell, or the last cell once the code is full.
        const isActive =
          focused && (i === value.length || (value.length >= length && i === length - 1));
        return (
          <View
            key={i}
            // Decorative: the code value is owned and announced by the hidden
            // TextInput, so the cells stay out of the accessibility tree.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.cell,
              isActive && styles.cellActive,
              error && styles.cellError,
            ]}
          >
            {char ? (
              <Text style={styles.digit}>{char}</Text>
            ) : isActive ? (
              <View style={styles.caret} />
            ) : null}
          </View>
        );
      })}

      {/* The real input: invisible, stretched over the whole row, owns the
          keyboard and the value. */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(raw) => onChange(raw.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        // The real caret and the selection highlight would draw over the cells,
        // which paint their own caret — keep both invisible.
        selectionColor="transparent"
        accessibilityLabel={accessibilityLabel}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  cellActive: {
    borderColor: colors.brand.primary,
  },
  cellError: {
    borderColor: colors.brand.primary,
  },
  digit: {
    ...typography.titleXl,
    color: colors.text.primary,
  },
  caret: {
    width: 2,
    height: 24,
    borderRadius: 1,
    backgroundColor: colors.brand.primary,
  },
  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Invisible by having nothing to draw — transparent text on a transparent
    // background — rather than by `opacity: 0`. An input at zero opacity does
    // not present the system «Вставить» menu on long-press, and the code here
    // arrives over WhatsApp/Telegram, where iOS SMS autofill never fires, so
    // pasting is the only way in and it has to work.
    backgroundColor: "transparent",
    color: "transparent",
  },
});
