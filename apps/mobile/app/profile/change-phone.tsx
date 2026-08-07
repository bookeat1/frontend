import { RepositoryError, type AuthUser } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthPhoneField } from "../../src/components/auth/AuthPhoneField";
import { OtpInput } from "../../src/components/auth/OtpInput";
import { FlowHeader } from "../../src/components/FlowHeader";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/lib/auth";
import { DEFAULT_COUNTRY, nationalLength } from "../../src/lib/countries";
import { useLocale } from "../../src/lib/locale";
import { formatStoredPhoneForDisplay, phoneFromE164 } from "../../src/lib/phone";

const CODE_LENGTH = 6;
/** Same server limits the sign-in screen mirrors (internal/bootstrap/config.go):
 * 1 OTP request per minute per phone, a 5-minute code TTL, and 5 wrong guesses
 * before the code is locked (maxOTPAttempts). */
const RESEND_COOLDOWN_SECONDS = 60;
const CODE_TTL_SECONDS = 5 * 60;
const MAX_CODE_ATTEMPTS = 5;

/** See sign-in.tsx: on a deployment whose OTP channels are off the server still
 * answers {"sent":true} and delivers nothing, so the screen says so instead of
 * stranding the tester at an empty field. */
const DELIVERY_DISABLED = process.env.EXPO_PUBLIC_OTP_DELIVERY_DISABLED === "1";

type Step = "phone" | "code";

/**
 * «Изменить номер» — moves the signed-in account onto a NEW phone number via a
 * one-time code sent to that new number. Two steps that mirror the sign-in UX
 * (loading overlay, resend / change-number affordances, inline field errors):
 *
 *   1. enter the new number  → repository.requestPhoneChangeOtp (authenticated)
 *   2. enter the code sent to it, auto-submitted on the 6th digit
 *      → repository.confirmPhoneChange (authenticated) → updated AuthUser
 *
 * On success the updated user is written into the ["me"] cache and we pop back
 * to «Персональные данные», which then shows the new number. Unlike sign-in
 * this NEVER writes the session token — the account and its bearer token are
 * unchanged, only the phone column moves.
 *
 * Error mapping is by HTTP status, the only honest signal (the RU wording lives
 * in i18n): 409 → number belongs to another account; 401 → wrong/expired code;
 * 422 → same-number/invalid; anything else → a generic offline/unknown line.
 */
export default function ChangePhoneScreen() {
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, repository } = useAuth();

  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => repository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });
  const currentPhone = me.data?.phone ?? null;

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneComplete, setPhoneComplete] = useState(false);
  const [code, setCode] = useState("");
  /** The number the current code was actually sent to, so «изменить номер»
   * cannot leave us verifying a code against a different phone. */
  const [sentToPhone, setSentToPhone] = useState("");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  const resendSecondsLeft =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - tick) / 1000));
  const codeAgeSeconds = sentAt === null ? 0 : Math.floor((tick - sentAt) / 1000);
  const codeProbablyExpired = sentAt !== null && codeAgeSeconds >= CODE_TTL_SECONDS;
  const needsTicking = step === "code" && (resendSecondsLeft > 0 || !codeProbablyExpired);

  useEffect(() => {
    if (!needsTicking) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsTicking]);

  const attemptsExhausted = attempts >= MAX_CODE_ATTEMPTS;

  /** Turns a failed request/verify into a sentence that is true, by status. */
  const describeError = (error: unknown): string => {
    const c = t.profile.changePhone;
    if (error instanceof RepositoryError) {
      if (error.isRateLimited) {
        return t.auth.errorRateLimited(error.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
      }
      // 409 — the number is (or just became) another account's.
      if (error.status === 409) return c.errorTakenByOther;
      // 401 — wrong/expired code (verify only).
      if (error.isUnauthorized) return c.errorCodeRejected;
      // 422 — the client already blocks an incomplete number, so the remaining
      // validation failure is the same-number case.
      if (error.isValidation) return c.errorSameNumber;
    }
    return c.errorGeneric;
  };

  const sendCode = async (e164: string, complete: boolean): Promise<void> => {
    setFormError(null);
    setFieldError(null);
    if (submitting) return; // double-submit guard on top of the disabled button
    if (!complete) {
      const expected = nationalLength(phoneFromE164(e164)?.country ?? DEFAULT_COUNTRY);
      setFieldError(t.auth.phoneIncomplete(expected ?? null));
      return;
    }
    // Same-number is caught on the client so the guest gets an instant, exact
    // reason instead of spending a request on a guaranteed 422.
    if (currentPhone && e164 === currentPhone) {
      setFieldError(t.profile.changePhone.errorSameNumber);
      return;
    }
    // Asking again inside the server's per-phone minute is a guaranteed refusal.
    if (e164 === sentToPhone && resendSecondsLeft > 0) {
      setFormError(t.auth.resendIn(resendSecondsLeft));
      return;
    }

    setSubmitting(true);
    try {
      const result = await repository.requestPhoneChangeOtp(e164);
      const now = Date.now();
      setSentToPhone(e164);
      setSentAt(now);
      setResendAt(now + RESEND_COOLDOWN_SECONDS * 1000);
      setAttempts(0);
      setDevCode(result.devCode);
      setCode("");
      setStep("code");
    } catch (error) {
      setFieldError(describeError(error));
      if (error instanceof RepositoryError && error.isRateLimited && error.retryAfterSeconds) {
        setResendAt(Date.now() + error.retryAfterSeconds * 1000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = async (value: string): Promise<void> => {
    setFormError(null);
    setFieldError(null);
    if (submitting) return;
    if (value.length !== CODE_LENGTH) {
      setFieldError(t.auth.codeIncomplete);
      return;
    }
    if (attemptsExhausted) {
      setFormError(t.auth.errorTooManyAttempts);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await repository.confirmPhoneChange({ newPhone: sentToPhone, code: value });
      // The updated account IS the new truth — drop it into the same cache
      // «Персональные данные» reads, then pop back to it showing the new number.
      queryClient.setQueryData(["me"], updated);
      if (router.canGoBack()) router.back();
      else router.replace("/profile/personal-data");
    } catch (error) {
      // The typed code is left in the field — an input wiped on failure loses a
      // guest who mistyped one digit.
      if (error instanceof RepositoryError && error.isUnauthorized) {
        const next = attempts + 1;
        setAttempts(next);
        setFormError(
          next >= MAX_CODE_ATTEMPTS
            ? t.auth.errorTooManyAttempts
            : t.profile.changePhone.errorCodeRejected,
        );
      } else {
        setFormError(describeError(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when the last digit lands — never the only way in, and guarded
  // so an SMS autofill cannot race a manual entry.
  const verifyingRef = useRef(false);
  const onCodeChange = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(next);
    if (fieldError) setFieldError(null);
    if (next.length === CODE_LENGTH && !submitting && !verifyingRef.current && !attemptsExhausted) {
      verifyingRef.current = true;
      void confirm(next).finally(() => {
        verifyingRef.current = false;
      });
    }
  };

  const changeNumber = () => {
    setStep("phone");
    setCode("");
    setFieldError(null);
    setFormError(null);
    setAttempts(0);
  };

  const isPhoneStep = step === "phone";
  const c = t.profile.changePhone;
  const requestLabel = submitting ? c.requestingCode : c.submitRequestCode;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader
          title={c.title}
          onBack={isPhoneStep ? () => router.back() : changeNumber}
        />
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
          {isPhoneStep ? (
            <>
              <Text style={styles.heading} accessibilityRole="header">
                {c.phoneStepTitle}
              </Text>
              <Text style={styles.subtitle}>{c.phoneStepSubtitle}</Text>

              <AuthPhoneField
                value={phone}
                onChange={({ e164, complete }) => {
                  setPhone(e164);
                  setPhoneComplete(complete);
                  if (fieldError) setFieldError(null);
                }}
                error={fieldError ?? undefined}
                editable={!submitting}
                autoFocus
                returnKeyType="go"
                accessibilityLabel={c.phoneLabel}
                onSubmitEditing={() => void sendCode(phone, phoneComplete)}
              />

              <PrimaryButton
                label={requestLabel}
                size="lg"
                onPress={() => void sendCode(phone, phoneComplete)}
                disabled={submitting || !phoneComplete}
              />
            </>
          ) : (
            <>
              <Text style={styles.heading} accessibilityRole="header">
                {c.codeStepTitle}
              </Text>
              <Text style={styles.subtitle}>
                {c.codeSentTo(formatStoredPhoneForDisplay(sentToPhone))}
              </Text>

              {DELIVERY_DISABLED ? (
                <Text style={styles.notice} accessibilityRole="alert">
                  {t.auth.deliveryDisabledNotice}
                </Text>
              ) : null}

              {__DEV__ && devCode ? (
                <Text style={styles.notice}>{t.auth.devCodeNotice(devCode)}</Text>
              ) : null}

              <OtpInput
                value={code}
                onChange={onCodeChange}
                length={CODE_LENGTH}
                autoFocus
                editable={!submitting && !attemptsExhausted}
                error={Boolean(formError) || Boolean(fieldError)}
                accessibilityLabel={t.auth.codeLabel}
              />

              {fieldError ? (
                <Text style={styles.codeError} accessibilityRole="alert">
                  {fieldError}
                </Text>
              ) : null}

              {codeProbablyExpired ? (
                <Text style={styles.hint}>{t.auth.codeProbablyExpired}</Text>
              ) : null}

              <View style={styles.codeActions}>
                {resendSecondsLeft > 0 ? (
                  <Text style={styles.countdown}>{t.auth.resendCountdown(resendSecondsLeft)}</Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: submitting }}
                    disabled={submitting}
                    onPress={() => void sendCode(sentToPhone, true)}
                    style={styles.linkRow}
                  >
                    <Text style={styles.link}>{t.auth.resend}</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={changeNumber}
                  style={styles.linkRow}
                >
                  <Text style={styles.link}>{t.auth.changePhone}</Text>
                </Pressable>
              </View>
            </>
          )}

          {formError ? (
            <Text style={styles.formError} accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {submitting ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : null}
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
    gap: spacing.lg,
  },
  heading: {
    ...typography.titleXl,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: -spacing.sm,
  },
  codeActions: {
    gap: spacing.sm,
  },
  countdown: {
    ...typography.body,
    color: colors.text.muted,
  },
  codeError: {
    ...typography.labelMedium,
    color: colors.brand.primary,
  },
  linkRow: {
    minHeight: 44,
    justifyContent: "center",
  },
  link: {
    ...typography.labelMedium,
    color: colors.brand.primary,
  },
  formError: {
    ...typography.labelMedium,
    color: colors.brand.primary,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  notice: {
    ...typography.caption,
    color: colors.text.primary,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  hint: {
    ...typography.caption,
    color: colors.text.muted,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay.dialogScrim,
  },
});
