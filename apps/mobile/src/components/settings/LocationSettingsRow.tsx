import { colors, hitSlop, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { trackEvent } from "../../lib/analytics";
import { useGuestLocation } from "../../lib/geo/guest-location";
import { useLocale } from "../../lib/locale";
import { MapPin } from "../icons";

/**
 * Строка «Геопозиция» в «Настройках» (спека geolocation-permission.md, M4,
 * критерий 15). Состояний четыре, и тап ведёт по-разному:
 *
 *   undetermined          → подсказка «Чтобы показывать сначала ближайшие…»;
 *                           тап вызывает системный диалог (единственный второй
 *                           путь к нему после карточки в «Поиске»)
 *   granted               → «Включена», тап → `Linking.openSettings()`
 *   granted, GPS выключен → «Геолокация на телефоне выключена», тап → настройки
 *   denied, нельзя спросить → «Выключена. Включите в настройках телефона»,
 *                           тап → настройки, `request` НЕ зовётся
 *   denied, можно спросить (Android после одного отказа) → тап = диалог
 *
 * Не рисуется вовсе, пока статус читается и когда геопозиции в сборке нет
 * (веб, бинарь без модуля): строка-пустышка в такой сборке была бы обещанием
 * без дела.
 */
export function LocationSettingsRow() {
  const { dictionary: t } = useLocale();
  const geo = useGuestLocation();
  const [working, setWorking] = React.useState(false);

  if (geo.permission === "pending" || geo.permission === "unsupported") return null;

  const canAsk =
    geo.permission === "undetermined" || (geo.permission === "denied" && geo.canAskAgain);

  const description =
    geo.permission === "granted"
      ? geo.servicesOff
        ? t.location.settingsServicesOff
        : t.location.settingsOn
      : geo.permission === "denied"
        ? t.location.settingsOff
        : t.location.settingsHintUndetermined;

  const onPress = () => {
    if (working) return;
    if (!canAsk) {
      void Linking.openSettings().catch(() => {});
      return;
    }
    setWorking(true);
    trackEvent("location_prompt_shown", { surface: "mobile_settings" });
    void geo
      .request()
      .then((outcome) => {
        trackEvent("location_permission_result", {
          surface: "mobile_settings",
          result: outcome.result,
          precise: outcome.precise,
        });
      })
      .finally(() => setWorking(false));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.location.settingsRow}
      accessibilityHint={description}
      accessibilityState={{ disabled: working }}
      disabled={working}
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <MapPin size={24} color={colors.text.primary} weight="regular" />
      <View style={styles.text}>
        <Text style={styles.label} numberOfLines={2}>
          {t.location.settingsRow}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: hitSlop.minTouchTarget + spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  description: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
