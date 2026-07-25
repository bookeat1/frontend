import { RepositoryError } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../src/components/FlowHeader";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { TextField } from "../../src/components/TextField";
import { useAuth } from "../../src/lib/auth";

const t = getDictionary();

type Mode = "sign-in" | "sign-up";

interface FieldErrors {
  email?: string;
  password?: string;
  fullName?: string;
}

/** Intentionally permissive: the backend is the authority (its own binding is
 * `email`), and refusing a valid-but-unusual address on the client is a bug
 * the guest can't work around. This only catches obvious typos. */
function validateEmail(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return t.auth.emailRequired;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t.auth.emailInvalid;
  return undefined;
}

/**
 * The sign-in gate.
 *
 * A booking cannot be created without a session (`POST /bookings` is on the
 * authenticated group), so the whole flow is browsable signed-out and stops
 * exactly here. Email + password is the only login that actually works on this
 * backend: `/auth/otp/request` answers `{"sent": true}` but the delivery
 * adapter is a stub — no SMS is ever sent and the code is withheld from the
 * logs outside development. See the note in src/lib/auth.tsx.
 *
 * On success this pops back to whatever pushed it (the reservation screen,
 * with its draft intact) rather than navigating anywhere itself.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === "sign-up";

  const validate = (): boolean => {
    const next: FieldErrors = {
      email: validateEmail(email),
      password: !password
        ? t.auth.passwordRequired
        : password.length < 6
          ? t.auth.passwordTooShort
          : undefined,
      fullName: isSignUp && !fullName.trim() ? t.auth.fullNameRequired : undefined,
    };
    setErrors(next);
    return !next.email && !next.password && !next.fullName;
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (submitting) return; // double-submit guard on top of the disabled button
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp({ email, password, fullName });
      } else {
        await signIn({ email, password });
      }
      // Back to the flow. Everything the guest typed there is still in the
      // draft — this screen was pushed on top of that stack, not instead of it.
      router.back();
    } catch (error) {
      // The typed input is deliberately left untouched: a failed sign-in that
      // wipes the form is the fastest way to lose a booking.
      if (error instanceof RepositoryError && error.isUnauthorized) {
        setFormError(t.auth.errorInvalidCredentials);
      } else if (error instanceof RepositoryError && error.status === 409) {
        setFormError(t.auth.errorEmailTaken);
      } else if (error instanceof RepositoryError && error.isValidation) {
        setFormError(t.auth.passwordTooShort);
      } else {
        setFormError(t.auth.errorDescription);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader
          title={isSignUp ? t.auth.signUpTitle : t.auth.signInTitle}
          onBack={() => router.back()}
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
          <Text style={styles.subtitle}>
            {isSignUp ? t.auth.signUpSubtitle : t.auth.signInSubtitle}
          </Text>

          {isSignUp ? (
            <TextField
              label={t.auth.fullNameLabel}
              placeholder={t.auth.fullNamePlaceholder}
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined }));
              }}
              error={errors.fullName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          ) : null}

          <TextField
            label={t.auth.emailLabel}
            placeholder={t.auth.emailPlaceholder}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <TextField
            label={t.auth.passwordLabel}
            placeholder={t.auth.passwordPlaceholder}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            textContentType={isSignUp ? "newPassword" : "password"}
            returnKeyType="go"
            onSubmitEditing={() => void handleSubmit()}
          />

          {formError ? (
            <Text style={styles.formError} accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}

          <Text style={styles.note}>{t.auth.phoneUnavailableNote}</Text>
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
          <View style={styles.footer}>
            <PrimaryButton
              label={
                submitting
                  ? t.auth.submitting
                  : isSignUp
                    ? t.auth.submitSignUp
                    : t.auth.submitSignIn
              }
              onPress={() => void handleSubmit()}
              disabled={submitting}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMode(isSignUp ? "sign-in" : "sign-up");
                setErrors({});
                setFormError(null);
              }}
              style={styles.switchMode}
            >
              <Text style={styles.switchModeLabel}>
                {isSignUp ? t.auth.toSignIn : t.auth.toSignUp}
              </Text>
            </Pressable>
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
  note: {
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
  switchMode: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  switchModeLabel: {
    ...typography.labelMedium,
    color: colors.brand.primary,
  },
});
