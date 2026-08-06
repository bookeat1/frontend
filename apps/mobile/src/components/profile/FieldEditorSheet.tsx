import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../PrimaryButton";
import { TextField } from "../TextField";

/**
 * A bottom sheet that edits ONE text field — the «Персональные данные» editor
 * from the Figma render: a title, a single prefilled input, and a red
 * «Сохранить». Same mechanics as `ProfileLogoutSheet` (bottom Modal, dimmed
 * backdrop, rounded top), plus a `KeyboardAvoidingView` so the input and button
 * rise above the keyboard the way the design draws them.
 *
 * The four states live where they belong: the parent owns `saving` (button
 * disabled + busy label) and `serverError` (a save the API refused); the sheet
 * owns the guest's draft and the one client rule it can check itself
 * (`requiredError` for an empty value). On failure NOTHING resets the draft —
 * whatever the guest typed stays on screen, exactly as `ProfileForm` does it.
 *
 * The parent decides success: it closes the sheet by flipping `visible` after
 * the save resolves, so a double tap is harmless (the sheet also guards it) and
 * the sheet never has to know what "saved" means.
 */
export function FieldEditorSheet({
  visible,
  title,
  label,
  initialValue,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoComplete,
  textContentType,
  saving,
  serverError,
  requiredError,
  saveLabel,
  savingLabel,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  /** Spoken label for the input (the visible label is the sheet title). */
  label: string;
  initialValue: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  /** True while the parent's save is in flight — locks the field and button. */
  saving: boolean;
  /** A message from a save the server refused. Shown under the field. */
  serverError?: string;
  /** Shown when the guest tries to save an empty value. */
  requiredError: string;
  saveLabel: string;
  savingLabel: string;
  /** Given the trimmed value. Only called for a non-empty value. */
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(initialValue);
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  // Start from the current stored value every time the sheet opens, so it never
  // shows a stale draft from a previous edit (or a previous field).
  useEffect(() => {
    if (visible) {
      setDraft(initialValue);
      setLocalError(undefined);
    }
  }, [visible, initialValue]);

  const submit = () => {
    if (saving) return;
    const trimmed = draft.trim();
    if (trimmed === "") {
      setLocalError(requiredError);
      return;
    }
    setLocalError(undefined);
    onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.root}
      >
        {/* Tap-to-dismiss backdrop — hidden from the screen reader so focus
            lands on the sheet, not an unnamed full-screen button. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          accessibilityViewIsModal
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <TextField
            label={label}
            labelHidden
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              setLocalError(undefined);
            }}
            placeholder={placeholder}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            textContentType={textContentType}
            editable={!saving}
            error={localError ?? serverError}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <PrimaryButton
            label={saving ? savingLabel : saveLabel}
            size="lg"
            onPress={submit}
            disabled={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay.dialogScrim,
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
});
