import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useId } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";

interface TextFieldProps {
  label: string;
  /** Hides the visible label but keeps it as the spoken one. The design's
   * "Special Requests" box is a bare rounded field whose card title already
   * names it (Figma node 471:3946) — a second label above it would be a
   * duplicate for sighted users and nothing for screen readers. */
  labelHidden?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Rendered under the field in brand red and announced to screen readers.
   * Presence of this string is also what turns the border red. */
  error?: string;
  /** Neutral helper text; hidden while `error` is showing so the two never
   * stack and push the submit button off a 360px screen. */
  hint?: string;
  /** Fixed, untypable text glued to the left of the input — the phone field's
   * "+7". It is NOT part of `value`: the guest can neither delete it nor put
   * the caret before it, which is the whole reason it is drawn separately. */
  prefix?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  secureTextEntry?: boolean;
  multiline?: boolean;
  editable?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
}

/**
 * The single text input primitive. Never drop a bare <TextInput> into a
 * screen — this one carries the label association, the error wiring and the
 * 44pt minimum height that the accessibility rule requires.
 */
export function TextField({
  label,
  labelHidden = false,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  prefix,
  maxLength,
  keyboardType,
  autoCapitalize = "sentences",
  autoComplete,
  textContentType,
  secureTextEntry,
  multiline = false,
  editable = true,
  returnKeyType,
  onSubmitEditing,
}: TextFieldProps) {
  const errorId = useId();
  const input = (
      <TextInput
        style={
          prefix
            ? styles.inputInner
            : [styles.input, multiline && styles.inputMultiline, Boolean(error) && styles.inputError]
        }
        maxLength={maxLength}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={label}
        // Both are set: iOS reads accessibilityInvalid, Android's TalkBack
        // picks the message up through the described-by association.
        accessibilityState={{ disabled: !editable }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
  );

  return (
    <View style={styles.root}>
      {labelHidden ? null : <Text style={styles.label}>{label}</Text>}
      {prefix ? (
        <View style={[styles.input, styles.inputWithPrefix, Boolean(error) && styles.inputError]}>
          {/* importantForAccessibility: the prefix is decoration — the input's
              own accessibilityLabel already names the whole field. */}
          <Text style={styles.prefix} importantForAccessibility="no">
            {prefix}
          </Text>
          {input}
        </View>
      ) : (
        input
      )}
      {error ? (
        <Text nativeID={errorId} style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
  },
  input: {
    minHeight: hitSlop.minTouchTarget,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: "transparent",
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  inputWithPrefix: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    // The row owns the padding; the input inside it must not add its own.
    paddingVertical: spacing.none,
  },
  prefix: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  inputInner: {
    flex: 1,
    minHeight: hitSlop.minTouchTarget,
    ...typography.labelMedium,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  inputMultiline: {
    // 80 in the design (Figma node 471:3946), not the 96 this was built with.
    minHeight: controlHeight.multilineField,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: colors.brand.primary,
  },
  error: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  hint: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
