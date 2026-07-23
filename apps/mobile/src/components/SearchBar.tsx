import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const t = getDictionary();

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChangeText, onSubmit, autoFocus }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon} accessibilityElementsHidden>
        ⌕
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={t.search.placeholder}
        placeholderTextColor={colors.neutral[400]}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={t.search.placeholder}
        clearButtonMode="never"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={t.a11y.searchClearButton}
          hitSlop={12}
          style={styles.clearButton}
        >
          <Text style={styles.clearGlyph}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 18,
    color: colors.neutral[400],
  },
  input: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.neutral[900],
    paddingVertical: spacing.sm,
  },
  clearButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  clearGlyph: {
    color: colors.neutral[500],
    fontSize: 14,
  },
});
