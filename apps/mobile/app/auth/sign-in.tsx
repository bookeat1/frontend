import { RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { PhoneField } from "../../src/components/PhoneField";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { TextField } from "../../src/components/TextField";
import { useToggleFavorite } from "../../src/hooks/useFavorites";
import { useAuth } from "../../src/lib/auth";
import { DEFAULT_COUNTRY, nationalLength } from "../../src/lib/countries";
import { formatStoredPhoneForDisplay, phoneFromE164 } from "../../src/lib/phone";

const t = getDictionary();

const CODE_LENGTH = 6;
/**
 * Server-side limits, read from the backend, not invented:
 * `AUTH_OTP_RATE_PER_MIN=1` per phone (internal/bootstrap/config.go) is what
 * the resend countdown mirrors, and `AUTH_OTP_TTL=5m` is how long a code is
 * accepted (internal/usecase/auth/otp.go stores `now + OTPTTL`).
 */
const RESEND_COOLDOWN_SECONDS = 60;
const CODE_TTL_SECONDS = 5 * 60;
/** `maxOTPAttempts` in internal/usecase/auth/otp.go: after five wrong guesses
 * the server rejects every further attempt against that code. */
const MAX_CODE_ATTEMPTS = 5;

/**
 * Set to "1" on an environment whose OTP delivery channels are not configured.
 * The server still answers `{"sent":true}` there — the waterfall degrades to
 * `otpsender.Stub`, which delivers nothing — so without this flag the guest
 * would sit in front of an empty field forever with no way to know why.
 */
const DELIVERY_DISABLED = process.env.EXPO_PUBLIC_OTP_DELIVERY_DISABLED === "1";

/**
 * Why the guest was sent here, carried as a route param by whoever pushed the
 * screen. It does two jobs and both are real: it picks the subtitle (a guest
 * who tapped a heart is not "завершая бронирование"), and for `favorite` it
 * says which action to finish once the session exists.
 */
type SignInReason = "booking" | "favorite";

type Step = "phone" | "code";

function parseReason(raw: string | undefined): SignInReason | undefined {
  return raw === "booking" || raw === "favorite" ? raw : undefined;
}

function subtitleFor(reason: SignInReason | undefined): string {
  switch (reason) {
    case "booking":
      return t.auth.signInSubtitleBooking;
    case "favorite":
      return t.auth.signInSubtitleFavorite;
    default:
      return t.auth.signInSubtitle;
  }
}

/**
 * The sign-in gate: phone number → one-time code. Nothing else.
 *
 * There is NO registration step and no password. `POST /auth/otp/verify` finds
 * or creates the user itself (internal/usecase/auth/otp.go: users.GetByPhone
 * → users.Create with PhoneVerifiedAt), so a first-time guest and a returning
 * one walk exactly the same two steps.
 *
 * WHAT THE SERVER WILL NOT TELL US (verified by curl on 2026-07-26): a wrong
 * code, an expired code, a phone with no active code and a phone locked out
 * after five wrong attempts are ALL `401 {"error":"unauthorized",
 * "code":"unauthorized"}`. The per-minute and per-hour phone limits are both
 * `422 {"code":"validation_failed"}` — the same code an invalid phone gets.
 * So this screen never claims to know which of them happened: it names the
 * possibilities and offers the one action that helps (a new code). The only
 * distinctions it can draw honestly are by HTTP status (422 vs 429) and by
 * counting the guest's own failed attempts on this device.
 *
 * On success it finishes the interrupted action (the favorite) and pops back
 * to whatever pushed it — with a real destination when the stack is empty.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { requestCode, signInWithCode } = useAuth();
  const params = useLocalSearchParams<{ reason?: string; restaurantId?: string }>();
  const reason = parseReason(params.reason);
  const restaurantId = params.restaurantId;
  const toggleFavorite = useToggleFavorite();

  const [step, setStep] = useState<Step>("phone");
  /** E.164 as the field reports it ("" until there is a number), plus the
   * field's own verdict on whether it is finished — the screen does not
   * re-derive a per-country digit count it has no business knowing. */
  const [phone, setPhone] = useState("");
  const [phoneComplete, setPhoneComplete] = useState(false);
  const [code, setCode] = useState("");
  /** The number the current code was sent to, so "изменить номер" cannot leave
   * the screen verifying a code against a different phone. */
  const [sentToPhone, setSentToPhone] = useState("");
  const [sentAt, setSentAt] = useState<number | null>(null);
  /** Epoch ms when the resend button becomes tappable again. */
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  // One timer drives both countdowns (resend, and "this code has probably
  // expired"). It stops itself once neither has anything left to count, so an
  // idle screen is not re-rendering once a second forever.
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

  /**
   * Leaves the gate. Normally that means popping back to the screen that
   * pushed it (the booking draft, Explore, the reservation) — but on a deep
   * link straight to /auth/sign-in the stack is empty and `back()` does
   * nothing at all. Then we go somewhere the guest can actually continue:
   * the venue they were looking at, or Explore.
   */
  const leave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(restaurantId ? `/restaurant/${restaurantId}` : "/");
  }, [router, restaurantId]);

  /**
   * Finishes what the guest started before they were stopped by the gate.
   *
   * `favorite`: the heart they tapped is applied here, so they do not have to
   * find the card and tap it again. If the write fails we do NOT pretend it
   * worked — we simply leave, and the heart stays empty on a screen where one
   * tap retries it (the venue cards on Explore / search).
   *
   * `booking`: nothing to replay. The draft is untouched on the screen
   * underneath, and submitting a booking is a decision the guest makes, not
   * something to fire behind their back on a screen they can't see.
   */
  const completeIntent = async (): Promise<void> => {
    if (reason !== "favorite" || !restaurantId) return;
    try {
      await toggleFavorite.mutateAsync({ restaurantId, favorite: true });
    } catch {
      // Deliberately swallowed: see above.
    }
  };

  /** Turns a failed `/auth/otp/request` into a sentence that is true. */
  const describeRequestError = (error: unknown): string => {
    if (error instanceof RepositoryError) {
      // Per-IP tier of the rate limiter. The server said how long to wait, so
      // that is the number shown — never a guess.
      if (error.isRateLimited) {
        return t.auth.errorRateLimited(error.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
      }
      // The only 422 left once the client has checked that the number is
      // complete: the per-phone budget (1/min, 5/hour).
      if (error.isValidation) return t.auth.errorTooOften;
    }
    return t.auth.errorDescription;
  };

  const sendCode = async (e164: string, complete: boolean): Promise<void> => {
    setFormError(null);
    setFieldError(null);
    if (submitting) return; // double-submit guard on top of the disabled button
    if (!complete) {
      // How many digits are missing is a property of the chosen country, so
      // the number in the message comes from the country table — and is left
      // out entirely for a country whose format we do not claim to know.
      const expected = nationalLength(phoneFromE164(e164)?.country ?? DEFAULT_COUNTRY);
      setFieldError(t.auth.phoneIncomplete(expected ?? null));
      return;
    }
    // Asking again inside the server's own per-phone minute is a guaranteed
    // 422; say so instead of spending the request and the guest's hourly
    // budget on it.
    if (e164 === sentToPhone && resendSecondsLeft > 0) {
      setFormError(t.auth.resendIn(resendSecondsLeft));
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestCode(e164);
      const now = Date.now();
      setSentToPhone(e164);
      setSentAt(now);
      setResendAt(now + RESEND_COOLDOWN_SECONDS * 1000);
      setAttempts(0);
      // Only ever non-null when the deployment runs with AUTH_OTP_DEV_EXPOSE,
      // and only rendered in a development build (see below).
      setDevCode(result.devCode);
      // On a test deployment whose delivery channels are off, the server's echo
      // is the ONLY way the code reaches the tester — so pre-fill it and let
      // them sign in with one tap. Double-gated: it needs BOTH the env flag AND
      // a code actually present in the response, so it is inert on production
      // (where `devCode` is always null) and on any build without the flag. The
      // pre-fill is set directly, NOT through onCodeChange, so it never
      // auto-submits — the tap on "Войти" stays deliberate.
      if (DELIVERY_DISABLED && result.devCode) {
        setCode(result.devCode.replace(/\D/g, "").slice(0, CODE_LENGTH));
      } else {
        setCode("");
      }
      setStep("code");
    } catch (error) {
      setFormError(describeRequestError(error));
      // A 429 tells us exactly how long the server wants to be left alone.
      if (error instanceof RepositoryError && error.isRateLimited && error.retryAfterSeconds) {
        setResendAt(Date.now() + error.retryAfterSeconds * 1000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async (value: string): Promise<void> => {
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
      await signInWithCode({ phone: sentToPhone, code: value });
      // Finish the interrupted action first (the favorite), then leave. The
      // button stays in its "Проверяем код…" state for the extra request
      // rather than flashing back to Explore with a heart that is still empty.
      await completeIntent();
      leave();
    } catch (error) {
      // The typed code is deliberately left in the field: an input that is
      // wiped on failure is the fastest way to lose a guest who mistyped one
      // digit.
      if (error instanceof RepositoryError && error.isRateLimited) {
        setFormError(t.auth.errorRateLimited(error.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS));
      } else if (error instanceof RepositoryError && error.isUnauthorized) {
        // 401 covers wrong / expired / no active code / locked out, and the
        // server will not say which. What we CAN count is how many times this
        // guest guessed, because the lockout threshold is a known constant.
        const next = attempts + 1;
        setAttempts(next);
        setFormError(
          next >= MAX_CODE_ATTEMPTS ? t.auth.errorTooManyAttempts : t.auth.errorCodeRejected,
        );
      } else if (error instanceof RepositoryError && error.isValidation) {
        setFieldError(t.auth.codeIncomplete);
      } else {
        setFormError(t.auth.errorDescription);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit is a convenience, never the only way in: the button below does
  // the same thing, and this guard keeps an SMS autofill from racing a tap.
  const verifyingRef = useRef(false);
  const onCodeChange = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(next);
    if (fieldError) setFieldError(null);
    if (next.length === CODE_LENGTH && !submitting && !verifyingRef.current && !attemptsExhausted) {
      verifyingRef.current = true;
      void verify(next).finally(() => {
        verifyingRef.current = false;
      });
    }
  };

  // On a delivery-disabled test build the code is pre-filled from the server's
  // echo (see requestCode). Submit it automatically the moment the code step
  // opens instead of waiting for a manual tap on "Войти" — a pre-filled code
  // that sits untouched goes stale (5-min TTL, or a resend rotates it) and the
  // tester is stranded on "код не подошёл". A ref keeps a rejected code from
  // resubmitting in a loop; a fresh request pre-fills a new code and re-arms.
  const autoSubmittedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!DELIVERY_DISABLED) return;
    if (step !== "code" || !sentToPhone) return;
    if (code.length !== CODE_LENGTH) return;
    if (submitting || verifyingRef.current || attemptsExhausted) return;
    if (autoSubmittedRef.current === code) return;
    autoSubmittedRef.current = code;
    verifyingRef.current = true;
    void verify(code).finally(() => {
      verifyingRef.current = false;
    });
    // verify is a per-render closure; re-arming on a new step/code is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, code, sentToPhone]);

  const changePhone = () => {
    setStep("phone");
    setCode("");
    setFieldError(null);
    setFormError(null);
    setAttempts(0);
  };

  const isPhoneStep = step === "phone";
  const submitLabel = isPhoneStep
    ? submitting
      ? t.auth.requestingCode
      : t.auth.submitRequestCode
    : submitting
      ? t.auth.verifying
      : t.auth.submitVerify;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader
          title={isPhoneStep ? t.auth.signInTitle : t.auth.codeTitle}
          // On the code step the arrow means "back to the number", which is
          // where a guest who mistyped it needs to go. On the first step it
          // leaves the gate — and never dead-ends when there is no history.
          onBack={isPhoneStep ? leave : changePhone}
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
              <Text style={styles.subtitle}>{subtitleFor(reason)}</Text>
              {/* The country selector is here for one reason and it is not
                  cosmetic: the account is CREATED by the number on verify
                  (users.GetByPhone → users.Create), so a foreign guest who
                  cannot enter their real number cannot get an account at all.
                  Kazakhstan is preselected, and a local guest never opens it. */}
              <PhoneField
                label={t.auth.phoneLabel}
                value={phone}
                onChange={({ e164, complete }) => {
                  setPhone(e164);
                  setPhoneComplete(complete);
                  if (fieldError) setFieldError(null);
                }}
                error={fieldError ?? undefined}
                hint={t.auth.phoneHint}
                editable={!submitting}
                returnKeyType="go"
                onSubmitEditing={() => void sendCode(phone, phoneComplete)}
              />
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>
                {t.auth.codeSentTo(formatStoredPhoneForDisplay(sentToPhone))}
              </Text>

              {/* The honest note for an environment that accepts the request
                  and delivers nothing. Off by default; see
                  EXPO_PUBLIC_OTP_DELIVERY_DISABLED in .env.example. */}
              {DELIVERY_DISABLED ? (
                <Text style={styles.notice} accessibilityRole="alert">
                  {t.auth.deliveryDisabledNotice}
                </Text>
              ) : null}

              {/* The server's OWN debug echo (AUTH_OTP_DEV_EXPOSE), never a
                  code invented here, and rendered only in a development build
                  so it cannot reach a release bundle. Absent on test. */}
              {__DEV__ && devCode ? (
                <Text style={styles.notice}>{t.auth.devCodeNotice(devCode)}</Text>
              ) : null}

              <TextField
                label={t.auth.codeLabel}
                placeholder={t.auth.codePlaceholder}
                value={code}
                onChangeText={onCodeChange}
                error={fieldError ?? undefined}
                keyboardType="number-pad"
                // iOS lifts the code straight out of the SMS; Android's
                // autofill uses the sms-otp hint.
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={CODE_LENGTH}
                returnKeyType="go"
                onSubmitEditing={() => void verify(code)}
              />

              {codeProbablyExpired ? (
                <Text style={styles.hint}>{t.auth.codeProbablyExpired}</Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: resendSecondsLeft > 0 || submitting }}
                disabled={resendSecondsLeft > 0 || submitting}
                onPress={() => void sendCode(sentToPhone, true)}
                style={styles.secondaryAction}
              >
                <Text
                  style={[
                    styles.secondaryActionLabel,
                    resendSecondsLeft > 0 && styles.secondaryActionLabelDisabled,
                  ]}
                >
                  {resendSecondsLeft > 0 ? t.auth.resendIn(resendSecondsLeft) : t.auth.resend}
                </Text>
              </Pressable>
            </>
          )}

          {formError ? (
            <Text style={styles.formError} accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
          <View style={styles.footer}>
            <PrimaryButton
              label={submitLabel}
              onPress={() => void (isPhoneStep ? sendCode(phone, phoneComplete) : verify(code))}
              disabled={
                submitting ||
                (isPhoneStep
                  ? !phoneComplete
                  : code.length !== CODE_LENGTH || attemptsExhausted)
              }
            />
            {isPhoneStep ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={changePhone}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionLabel}>{t.auth.changePhone}</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
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
    padding: spacing.lg,
    gap: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
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
  footerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  secondaryAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionLabel: {
    ...typography.labelMedium,
    color: colors.brand.primary,
    textAlign: "center",
  },
  secondaryActionLabelDisabled: {
    color: colors.text.muted,
  },
});
