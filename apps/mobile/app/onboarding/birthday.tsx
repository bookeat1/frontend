import type { AuthUser } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/lib/auth";
import { useLocale } from "../../src/lib/locale";
import { birthDateBounds, classifyProfileSaveFailure } from "../../src/lib/profile-edit";

/**
 * Шаг «Укажите дату рождения» — идёт СРАЗУ ЗА ИМЕНЕМ при первом входе
 * (макет 3z0f6dgev4HMwBAHPjTjPo, node 3073:11627).
 *
 * Три отдельных поля — день, месяц, год, — а не календарь: в макете так, и на
 * регистрации это быстрее. В профиле дата по-прежнему правится календарём:
 * там человек уточняет уже введённое, и листать календарь удобнее, чем
 * набирать цифры. Разные задачи — разные способы ввода.
 *
 * Фокус переезжает в следующее поле сам, как только текущее заполнено: иначе
 * ввод даты из трёх полей превращается в три отдельных касания.
 *
 * ГРАНИЦЫ ДАТЫ берутся из `birthDateBounds` — той же функции, что проверяет
 * дату в профиле, а она, в свою очередь, повторяет правило сервера (строго в
 * прошлом, не старше 120 лет). Своей копии правила здесь нет намеренно: две
 * копии разъезжаются, и человек получает 422 вместо подсказки.
 *
 * В отличие от шага с именем, этот шаг НЕ стена: дата рождения не нужна ни
 * одной брони, и держать гостя на ней нельзя. Стрелка «назад» уводит на
 * главную без сохранения.
 */
export default function OnboardingBirthdayScreen() {
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { repository } = useAuth();

  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const inFlight = useRef(false);

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  // "YYYY-MM-DD" — тот же вид, что принимает сервер и хранит профиль.
  const birthDate = useMemo(() => {
    if (day.length === 0 || month.length === 0 || year.length !== 4) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }, [day, month, year]);

  const valid = useMemo(() => {
    if (birthDate === "") return false;
    // Дата должна СУЩЕСТВОВАТЬ: 31 февраля Date молча превратит в 3 марта,
    // поэтому сверяем разобранное значение с введённым.
    const parsed = new Date(`${birthDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    if (parsed.toISOString().slice(0, 10) !== birthDate) return false;

    const { earliest, latest } = birthDateBounds(new Date());
    return birthDate <= latest && birthDate >= earliest;
  }, [birthDate]);

  const save = useCallback(async () => {
    if (inFlight.current || !valid) return;
    inFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const updated: AuthUser = await repository.updateMe({ birthDate });
      queryClient.setQueryData(["me"], updated);
      router.replace("/");
    } catch (err) {
      const reason = classifyProfileSaveFailure(err);
      const f = t.profile.edit.failure;
      setError(
        reason === "session_expired"
          ? f.sessionExpired
          : reason === "rejected"
            ? f.rejected
            : reason === "offline"
              ? f.offline
              : f.unknown,
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [birthDate, valid, repository, queryClient, router, t]);

  /** Оставляет только цифры и не даёт полю перерасти свою длину. */
  const digits = (value: string, max: number) => value.replace(/[^0-9]/g, "").slice(0, max);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title="" onBack={() => router.replace("/")} />
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={styles.heading} accessibilityRole="header">
              {t.onboarding.birthday.title}
            </Text>

            <View style={styles.inputs}>
              <TextInput
                style={styles.input}
                value={day}
                onChangeText={(value) => {
                  const next = digits(value, 2);
                  setDay(next);
                  if (error) setError(undefined);
                  if (next.length === 2) monthRef.current?.focus();
                }}
                placeholder={t.onboarding.birthday.day}
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                accessibilityLabel={t.onboarding.birthday.day}
                editable={!saving}
                autoFocus
              />
              <TextInput
                ref={monthRef}
                style={styles.input}
                value={month}
                onChangeText={(value) => {
                  const next = digits(value, 2);
                  setMonth(next);
                  if (error) setError(undefined);
                  if (next.length === 2) yearRef.current?.focus();
                }}
                placeholder={t.onboarding.birthday.month}
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                accessibilityLabel={t.onboarding.birthday.month}
                editable={!saving}
              />
              <TextInput
                ref={yearRef}
                style={styles.input}
                value={year}
                onChangeText={(value) => {
                  setYear(digits(value, 4));
                  if (error) setError(undefined);
                }}
                placeholder={t.onboarding.birthday.year}
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                accessibilityLabel={t.onboarding.birthday.year}
                editable={!saving}
              />
            </View>

            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </View>

          <PrimaryButton
            label={saving ? t.onboarding.birthday.saving : t.onboarding.birthday.save}
            size="lg"
            onPress={() => void save()}
            disabled={!valid || saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  flex: {
    flex: 1,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    // Просвет 24 между блоком поля и кнопкой (node 3073:11631).
    gap: spacing.xxl,
  },
  field: {
    gap: spacing.lg,
  },
  heading: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  // Три поля одной ширины, просвет 6 — в шкале такого шага нет, поэтому он
  // собран из существующих токенов, а не написан числом.
  inputs: {
    flexDirection: "row",
    gap: spacing.xs + 2,
  },
  input: {
    flex: 1,
    height: 56,
    borderRadius: radius.field,
    backgroundColor: colors.background.screen,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text.primary,
  },
  error: {
    ...typography.caption,
    color: colors.status.negativeTextOnSurface,
  },
});
