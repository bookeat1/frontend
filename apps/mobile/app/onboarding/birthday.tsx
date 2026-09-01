import type { AuthUser } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
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
import { parseBirthDateInput } from "../../src/lib/birth-date-input";
import { BIRTH_DATE_STEP_SKIPPABLE } from "../../src/lib/onboarding";
import { classifyProfileSaveFailure } from "../../src/lib/profile-edit";

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
 * ПРОВЕРКУ ДЕЛАЕТ `parseBirthDateInput` — общий разбор набранной цифрами
 * даты, тот же, что стоит в диалоге даты рождения в профиле. Он же держит
 * границы (строго в прошлом, не старше 120 лет) через `birthDateBounds`.
 * Своей копии правила здесь нет намеренно: две копии разъезжаются, и человек
 * получает 422 вместо подсказки.
 *
 * ОШИБКА НАЗЫВАЕТСЯ ВСЛУХ (правка владельца 2026-09-01). Раньше неверная дата
 * просто гасила кнопку «Сохранить»: гость набирал 31.02, кнопка не нажималась,
 * и почему — не сообщалось нигде. Теперь кнопка живая, а нажатие на неверной
 * дате печатает причину: «такой даты не существует», «дата в будущем»,
 * «проверьте год», «введите дату полностью». Кнопка гаснет ровно на время
 * сохранения.
 *
 * ПОКАЗЫВАЕТСЯ ТОЛЬКО НОВОМУ АККАУНТУ. Кто новый — решает `postSignInStep`
 * (src/lib/onboarding.ts) по ответу сервера, а не по пустой дате рождения:
 * у давнего гостя она тоже бывает пустой, и ловить его здесь нельзя. Давний
 * гость правит дату в «Персональных данных», календарём.
 *
 * МОЖНО ЛИ ПРОПУСТИТЬ — один переключатель `BIRTH_DATE_STEP_SKIPPABLE` в
 * src/lib/onboarding.ts, и там же написано, почему сейчас он `true`. Пока он
 * `true`, отсюда есть два выхода без сохранения: стрелка «назад» и кнопка
 * «Пропустить». Поставленный в `false` он превращает шаг в стену — как шаг
 * имени: ни стрелки, ни кнопки, ни аппаратной кнопки Android.
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

  /** Уйти без сохранения. Существует ровно пока шаг необязательный. */
  const skip = useCallback(() => router.replace("/"), [router]);

  // Аппаратная кнопка «назад» на Android: пока шаг можно пропустить, она его и
  // пропускает; когда нельзя — гасится, иначе «стена» обходится одним нажатием
  // системной кнопки. Обработчик один и там же, где переключатель, — чтобы
  // «непропускаемый» шаг не оказался пропускаемым через Android.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!BIRTH_DATE_STEP_SKIPPABLE) return true;
      skip();
      return true;
    });
    return () => sub.remove();
  }, [skip]);

  // Три поля — это ОДНА набранная дата: склеиваем их в восемь цифр и отдаём
  // общему разбору. Однозначные день и месяц дополняются нулём («1» и «2» —
  // это 01.02), пустые не дополняются: тогда цифр меньше восьми, и разбор
  // честно скажет «дата не дописана», а не соберёт из «00» несуществующий
  // день.
  const parsed = useMemo(() => {
    const digits =
      day.length > 0 && month.length > 0
        ? `${day.padStart(2, "0")}${month.padStart(2, "0")}${year}`
        : `${day}${month}${year}`;
    return parseBirthDateInput(digits, new Date());
  }, [day, month, year]);

  const save = useCallback(async () => {
    if (inFlight.current || saving) return;
    // Причина отказа называется вслух — молча погашенная кнопка не объясняет
    // ничего. `empty` и `incomplete` для гостя одно и то же: дата не дописана.
    if (parsed.status !== "ok") {
      const errors = t.profile.edit.errors;
      setError(
        parsed.status === "invalid"
          ? errors[parsed.error]
          : errors.birth_date_incomplete,
      );
      return;
    }
    const birthDate = parsed.dateKey;
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
  }, [parsed, saving, repository, queryClient, router, t]);

  /** Оставляет только цифры и не даёт полю перерасти свою длину. */
  const digits = (value: string, max: number) => value.replace(/[^0-9]/g, "").slice(0, max);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title="" onBack={BIRTH_DATE_STEP_SKIPPABLE ? skip : undefined} />
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

          <View style={styles.actions}>
            {/* Кнопка ЖИВАЯ на неверной дате: она печатает причину. Гаснет
                только на время сохранения — двойное нажатие безопасно и без
                этого (страхует `inFlight`), но крутящаяся надпись не должна
                выглядеть нажимаемой. */}
            <PrimaryButton
              label={saving ? t.onboarding.birthday.saving : t.onboarding.birthday.save}
              size="lg"
              onPress={() => void save()}
              disabled={saving}
            />
            {BIRTH_DATE_STEP_SKIPPABLE ? (
              <>
                <PrimaryButton
                  label={t.onboarding.birthday.skip}
                  size="lg"
                  variant="secondary"
                  onPress={skip}
                  disabled={saving}
                />
                <Text style={styles.skipHint}>{t.onboarding.birthday.skipHint}</Text>
              </>
            ) : null}
          </View>
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
  actions: {
    gap: spacing.md,
  },
  skipHint: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: "center",
  },
});
