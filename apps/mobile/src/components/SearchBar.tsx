import { colors, controlHeight, radius, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { MagnifyingGlass, X } from "./icons";

const t = getDictionary();

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Подпись пустого поля. По умолчанию — общий поиск по заведениям; экран
   * меню передаёт свою («Название блюда или ингредиента», node 3563:7055),
   * потому что ищет он по другому. Второй компонент поля ради одной строки
   * заводить нельзя: у него сразу разъедутся высота, радиус и крестик.
   *
   * Она же — метка для скринридера: поле без видимой подписи должно
   * называть себя само.
   */
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  /** Fires when the field takes focus — the search screen shows its suggestions then. */
  onFocus?: () => void;
  onBlur?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  autoFocus,
  onFocus,
  onBlur,
  placeholder = t.search.placeholder,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <MagnifyingGlass size={24} color={colors.text.muted} weight="regular" />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
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
          <X size={14} color={colors.text.mutedStrong} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    // 48 — высота поля из макета (Figma 3z0f6dgev4HMwBAHPjTjPo,
    // node 918:12556: `h-[48px]`), она же `controlHeight.pill`. Было 44 —
    // минимальная цель касания, а не значение макета: поле стояло на 4 ниже
    // нарисованного и весь ряд под ним уезжал вверх.
    height: controlHeight.pill,
    backgroundColor: colors.background.chipAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: 8,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.text.muted,
    alignItems: "center",
    justifyContent: "center",
  },
});
