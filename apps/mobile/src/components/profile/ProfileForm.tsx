import type { AuthUser, ProfileUpdate } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatStoredPhoneForDisplay } from "../../lib/phone";
import {
  classifyProfileSaveFailure,
  draftFromUser,
  profilePatch,
  validateProfileDraft,
  type ProfileDraft,
  type ProfileErrors,
  type ProfileSaveFailure,
} from "../../lib/profile-edit";
import { CaretRight, MapPin } from "../icons";
import { PrimaryButton } from "../PrimaryButton";
import { SelectRow } from "../SelectRow";
import { TextField } from "../TextField";
import { BirthDateField } from "./BirthDateField";

const t = getDictionary();
const copy = t.profile.edit;

/**
 * The editable half of «Профиль».
 *
 * Lives in a component of its own, not inside `app/profile.tsx`, for two
 * reasons: the screen is an expo-router route and cannot be mounted in a test
 * (see TESTING.md), and this is where the guest's unsaved text lives — the one
 * thing that must survive everything that can go wrong around it.
 *
 * The four states are all here: idle, saving (button disabled, the whole form
 * locked), saved (a confirmation that clears the moment anything is typed
 * again), and failed with a reason the guest can act on.
 *
 * WHAT IS NOT EDITABLE, AND WHY (all verified against the Go handler and DTO,
 * not assumed):
 *   - phone: not a `PATCH /users/me` field (`updateMeRequest` has no phone) —
 *     `POST /auth/otp/verify` finds-or-creates the account BY the number, so it
 *     can only change through the dedicated OTP re-verification flow. Shown
 *     under the sign-in screen's own +7 (XXX) XXX-XX-XX mask (not raw E.164),
 *     and when the host passes `onEditPhone` the row routes into that flow —
 *     mirroring /profile/personal-data so the two screens do not contradict
 *     each other about whether the number can be changed.
 *   - email: same — not in the PATCH body at all.
 *   - avatar_url / preferred_language / country_code / cuisine_category_ids:
 *     accepted by the endpoint, but this app has no honest source for any of
 *     them (no upload endpoint, one shipped locale, no ISO-3166 country list,
 *     and the cuisine ids are `restaurant_categories` UUIDs the guest app never
 *     receives). Left out rather than invented.
 */
export function ProfileForm({
  user,
  onSave,
  onSaved,
  onSessionExpired,
  onSignIn,
  onEditCity,
  onEditPhone,
}: {
  user: AuthUser;
  onSave: (patch: ProfileUpdate) => Promise<AuthUser>;
  /** Called with the server's answer, which is the new truth, and with the
   * PATCH that produced it. The patch matters to the caller: it carries only
   * the fields the guest actually changed, so «город изменён этим сохранением»
   * is `patch.city !== undefined` — the answer alone cannot tell the two
   * apart. */
  onSaved?: (updated: AuthUser, patch: ProfileUpdate) => void;
  /** The session died mid-edit and could not be refreshed. The screen uses this
   * to keep this form mounted instead of swapping in «Вы не вошли», which
   * would take the guest's unsaved text with it. */
  onSessionExpired?: () => void;
  onSignIn?: () => void;
  /**
   * Opens the city picker. Given the current city and an `apply` callback to
   * write the chosen one back into the draft. When omitted (e.g. in tests, which
   * mount this form without a router) the city stays a free-text field — the
   * navigation, not the field, is what needs a router.
   */
  onEditCity?: (currentCity: string, apply: (city: string) => void) => void;
  /**
   * Opens the change-phone flow. Given like `onEditCity`, because the navigation
   * (not the field) is what needs a router — when omitted (tests) the phone stays
   * a plain, non-interactive read-out. Present in the real screen, where it
   * routes into /profile/change-phone exactly as /profile/personal-data does, so
   * the two entry points agree that the number IS changeable.
   */
  onEditPhone?: () => void;
}) {
  // `original` is what the last successful load/save returned; the draft is
  // what the guest typed. They are separate so a failure can leave the draft
  // untouched — nothing here ever resets the form on an error path.
  const [original, setOriginal] = useState<AuthUser>(user);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromUser(user));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<ProfileSaveFailure | null>(null);
  // Guards a double tap in the window before `saving` has re-rendered. A second
  // PATCH is not destructive (the body is the same), but it spends a request
  // and can answer out of order.
  const inFlight = useRef(false);

  const patchField = useCallback((field: keyof ProfileDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaved(false);
    setFailure(null);
  }, []);

  const submit = useCallback(async () => {
    if (inFlight.current) return;

    const found = validateProfileDraft(draft, original, new Date());
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setSaved(false);
      setFailure(null);
      return;
    }
    setErrors({});

    const patch = profilePatch(draft, original);
    if (!patch) {
      // Nothing changed. The endpoint answers 422 to an empty body, and
      // «Сохранено» is honest here: what the guest sees IS what is stored.
      setSaved(true);
      setFailure(null);
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setFailure(null);
    try {
      const updated = await onSave(patch);
      setOriginal(updated);
      setDraft(draftFromUser(updated));
      setSaved(true);
      onSaved?.(updated, patch);
    } catch (error) {
      // Note what does NOT happen here: the draft is not touched. Whatever the
      // guest typed is still on screen, whichever way this failed.
      const reason = classifyProfileSaveFailure(error);
      setFailure(reason);
      setSaved(false);
      if (reason === "session_expired") onSessionExpired?.();
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [draft, onSave, onSaved, onSessionExpired, original]);

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>{copy.title}</Text>

      <TextField
        label={t.profile.nameLabel}
        value={draft.fullName}
        onChangeText={(value) => patchField("fullName", value)}
        editable={!saving}
        error={errors.fullName ? copy.errors[errors.fullName] : undefined}
        autoComplete="name"
        textContentType="name"
      />

      {/* City is a picker when a router is available (the real screen), a
          free-text field otherwise. The draft value is a plain string either
          way, so `profilePatch` and the wire are identical — clearing it (the
          picker's "не указывать город") writes "" exactly as typing nothing
          did, which is how PATCH /users/me clears the column. */}
      {onEditCity ? (
        <SelectRow
          icon={MapPin}
          label={copy.cityLabel}
          value={draft.city}
          placeholder={copy.cityPlaceholder}
          onPress={() => onEditCity(draft.city, (city) => patchField("city", city))}
        />
      ) : (
        <TextField
          label={copy.cityLabel}
          value={draft.city}
          onChangeText={(value) => patchField("city", value)}
          editable={!saving}
          placeholder={copy.cityPlaceholder}
          hint={copy.cityHint}
        />
      )}

      {/* Дату НАБИРАЮТ цифрами — календарь убран (правка владельца
          2026-09-01, вечер). Пока набранное складывается в настоящую дату,
          черновик держит «YYYY-MM-DD» и провод не меняется; пока не
          складывается — черновик держит саму набранную строку, и
          `validateProfileDraft` называет причину по «Сохранить». Пустая
          строка на её месте означала бы «даты нет», и недопечатанная дата
          молча сохранилась бы как отсутствие даты. */}
      <BirthDateField
        label={copy.birthDateLabel}
        value={draft.birthDate}
        onChange={(value) => patchField("birthDate", value)}
        disabled={saving}
        hint={copy.birthDateHint}
        error={errors.birthDate ? copy.errors[errors.birthDate] : undefined}
      />

      {/* Not a `PATCH /users/me` field — the account is keyed on it, so it moves
          only through the OTP re-verification flow. Masked with the SAME
          formatter the phone FIELD uses, so the number reads back as the guest
          typed it — "+7 (701) 000-00-00", not the "+77010000000" the API speaks.
          Since the field gained a country selector this also holds for a foreign
          account: a US number is shown "+1 (212) 555-1234" under its own
          country's format, never re-attributed to Kazakhstan; a country whose
          format we do not claim to know is printed exactly as stored (see
          formatStoredPhoneForDisplay).

          When the host passes `onEditPhone` the row is tappable and routes into
          /profile/change-phone, mirroring /profile/personal-data. Without it
          (tests, which mount this form router-free) it stays a non-interactive
          read-out. Either way the old "номер изменить нельзя" hint is gone —
          the number IS changeable now, and a screen that still said otherwise
          would contradict personal-data. */}
      {onEditPhone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.profile.personalData.editPhoneA11y}
          onPress={onEditPhone}
          style={({ pressed }) => [styles.phoneRow, pressed && styles.phonePressed]}
        >
          <View style={[styles.readOnly, styles.phoneText]}>
            <Text style={styles.readOnlyLabel}>{t.profile.phoneLabel}</Text>
            <Text style={styles.readOnlyValue}>
              {original.phone ? formatStoredPhoneForDisplay(original.phone) : t.profile.phoneEmpty}
            </Text>
          </View>
          <CaretRight size={20} color={colors.text.muted} weight="regular" />
        </Pressable>
      ) : (
        <View style={styles.readOnly}>
          <Text style={styles.readOnlyLabel}>{t.profile.phoneLabel}</Text>
          <Text style={styles.readOnlyValue}>
            {original.phone ? formatStoredPhoneForDisplay(original.phone) : t.profile.phoneEmpty}
          </Text>
        </View>
      )}

      <PrimaryButton
        label={saving ? copy.saving : copy.save}
        onPress={() => void submit()}
        disabled={saving}
      />

      {saved ? (
        <Text style={styles.saved} accessibilityRole="alert">
          {copy.saved}
        </Text>
      ) : null}

      {failure ? (
        <View style={styles.failure}>
          <Text style={styles.failureText} accessibilityRole="alert">
            {failure === "session_expired"
              ? copy.failure.sessionExpired
              : failure === "rejected"
                ? copy.failure.rejected
                : failure === "offline"
                  ? copy.failure.offline
                  : copy.failure.unknown}
          </Text>
          {failure === "session_expired" && onSignIn ? (
            <PrimaryButton
              variant="secondary"
              label={copy.failure.signInAgain}
              onPress={onSignIn}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.labelMedium,
    color: colors.text.mutedStrong,
  },
  readOnly: {
    gap: spacing.xxs,
  },
  phoneText: {
    flex: 1,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
  },
  phonePressed: {
    opacity: 0.7,
  },
  readOnlyLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  readOnlyValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  saved: {
    ...typography.caption,
    color: colors.text.mutedStrong,
  },
  failure: {
    gap: spacing.sm,
  },
  failureText: {
    ...typography.caption,
    color: colors.brand.primary,
  },
});
