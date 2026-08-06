import { RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OtpInput } from "../../src/components/auth/OtpInput";
import { FlowHeader } from "../../src/components/FlowHeader";
import { PhoneField } from "../../src/components/PhoneField";
import { PrimaryButton } from "../../src/components/PrimaryButton";
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
 * The privacy policy the consent line links to. Left null until the real URL is
 * confirmed — while null the phrase renders as plain styled text with no dead
 * link, so we never ship a tap that lands on a 404. TODO(auth): set to the
 * confirmed book-eat.com policy URL and the link goes live.
 */
const PRIVACY_POLICY_URL: string | null = null;

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
    // Re-arm the dev-prefill auto-submit so a fresh code can fire again even if
    // a fixed debug code happens to repeat (see the effect above).
    autoSubmittedRef.current = null;
  };

  const isPhoneStep = step === "phone";
  const requestLabel = submitting ? t.auth.requestingCode : t.auth.submitRequestCode;

  // The consent link is inert until a real policy URL is configured — see
  // PRIVACY_POLICY_URL. Then it opens in the system browser.
  const openPrivacy = useCallback(() => {
    if (PRIVACY_POLICY_URL) void Linking.openURL(PRIVACY_POLICY_URL);
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        {/* No centred title — the big left-aligned heading lives in the content
            (Figma node 997:10239). The arrow only appears where there is
            somewhere to go: "back to the number" on the code step, and, on the
            phone step, back out of the gate only when it was pushed onto a
            stack (a booking/favourite flow) — the happy path from «Профиль»
            has no arrow, matching the design. */}
        <FlowHeader
          title=""
          onBack={isPhoneStep ? (router.canGoBack() ? leave : undefined) : changePhone}
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
                {t.auth.phoneStepTitle}
              </Text>
              {/* The design's happy path has no subtitle; a gated flow keeps its
                  "why you're here" line (завершить бронирование / избранное). */}
              {reason ? <Text style={styles.subtitle}>{subtitleFor(reason)}</Text> : null}

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
                autoFocus
                returnKeyType="go"
                onSubmitEditing={() => void sendCode(phone, phoneComplete)}
              />

              <PrimaryButton
                label={requestLabel}
                size="lg"
                onPress={() => void sendCode(phone, phoneComplete)}
                disabled={submitting || !phoneComplete}
              />

              <Text style={styles.consent}>
                {t.auth.consentPrefix}
                <Text
                  style={styles.consentLink}
                  onPress={PRIVACY_POLICY_URL ? openPrivacy : undefined}
                >
                  {t.auth.consentLink}
                </Text>
                {t.auth.consentSuffix}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heading} accessibilityRole="header">
                {t.auth.codeTitle}
              </Text>
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

              {/* Six segmented cells. Verification fires automatically when the
                  last digit lands (onCodeChange), so the code step has no
                  primary button — matching the design. */}
              <OtpInput
                value={code}
                onChange={onCodeChange}
                length={CODE_LENGTH}
                autoFocus
                editable={!submitting && !attemptsExhausted}
                error={Boolean(formError) || Boolean(fieldError)}
                accessibilityLabel={t.auth.codeLabel}
              />

              {/* The code-step field error as TEXT, not just red cells: verify()
                  can set it on a 422 from /auth/otp/verify, and with no submit
                  button here the message is the only thing telling the guest
                  what went wrong. */}
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
                  onPress={changePhone}
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

      {/* Dim + spinner while a request is in flight (design state 3 for the
          code request; also covers the auto-verify on the code step so a slow
          verify does not look like a frozen screen). */}
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
    // Pull up under the heading: the section gap is meant for block spacing.
    marginTop: -spacing.sm,
  },
  consent: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: -spacing.sm,
  },
  consentLink: {
    ...typography.caption,
    color: colors.brand.primary,
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
