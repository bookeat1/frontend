import { RepositoryError, type AuthUser, type ProfileUpdate } from "@bookeat/api";

/**
 * The rules behind «Профиль» → редактирование, kept out of the component so
 * they can be tested at the boundary instead of through a rendered form.
 *
 * EVERY rule here is either the server's own or deliberately TIGHTER than it,
 * never looser: a guest who is told «сохранено» and then rejected has been
 * lied to. The server's rules were read from
 * internal/usecase/users/facade.go + internal/transport/rest/users/request.go
 * (backend `develop`, 2026-07-27), not guessed:
 *
 *   full_name  — no server validation at all
 *   city       — no server validation at all
 *   birth_date — must parse as "YYYY-MM-DD" (time.Parse), must be strictly
 *                before `time.Now()` in UTC, and must not be before
 *                `now.AddDate(-120, 0, 0)`
 *
 * Two of those are compared against an INSTANT while the guest picks a
 * CALENDAR DATE, and a date is sent as midnight UTC. In Almaty (UTC+5) "today"
 * is still yesterday in UTC for five hours every morning, so "today" is
 * accepted by the server for part of the day and rejected for the rest. The
 * client therefore refuses both boundary days outright — a rule one day
 * tighter on each end, which can only ever turn a server rejection into an
 * inline hint, never the other way round.
 */

/** What the form holds. Strings, because that is what a text field gives us —
 * "нет значения" is `""`, never null. */
export interface ProfileDraft {
  fullName: string;
  city: string;
  /**
   * «YYYY-MM-DD», «» — даты нет, либо ещё не сложившаяся набранная строка
   * («04.05.19»). Третий случай появился, когда календарь убрали
   * (2026-09-01): поле, в которое НАБИРАЮТ, обязано уметь быть недописанным,
   * а «» на его месте означало бы «даты нет» и молча сохранило бы пустоту.
   */
  birthDate: string;
}

export type ProfileField = keyof ProfileDraft;

/**
 * Machine-readable reasons, mapped to Russian by the form. Kept as codes for
 * the same reason the API's error codes are: the wording changes, the rule
 * does not, and a test that asserts on wording tests the dictionary.
 */
export type ProfileValidationError =
  | "name_required"
  | "birth_date_incomplete"
  | "birth_date_format"
  | "birth_date_not_past"
  | "birth_date_too_old"
  | "birth_date_cannot_clear";

export type ProfileErrors = Partial<Record<ProfileField, ProfileValidationError>>;

/** Maximum age the server tolerates (`maxAgeYears` in the users facade). */
const MAX_AGE_YEARS = 120;

/** Сколько цифр в полностью набранной дате: 2 + 2 + 4. */
const FULL_BIRTH_DATE_DIGITS = 8;

export function draftFromUser(user: AuthUser): ProfileDraft {
  return {
    fullName: user.fullName,
    city: user.city ?? "",
    birthDate: user.birthDate ?? "",
  };
}

/** True when the string is a real calendar date in "YYYY-MM-DD" — 2026-02-31
 * parses in JS as 3 March and would be silently accepted otherwise. */
function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/** Midnight UTC of the calendar day `now` falls on in UTC. */
function utcMidnight(now: Date): Date {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function shiftDateKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The inclusive range of birth dates this app will accept, as date keys.
 *
 * ONE definition, used by two things that must never disagree: the validator
 * below, and the calendar the guest picks from. A picker that offers a day the
 * validator then refuses is a trap — the guest taps a date and gets a red line
 * for obeying the control they were given. So the calendar greys out exactly
 * what `validateProfileDraft` would reject, because both read this.
 *
 * Both ends are one day tighter than the server (see the note at the top of
 * this file): `latest` is YESTERDAY in UTC, not today, and `earliest` is the
 * day AFTER "120 years ago" — the two days the server's date-vs-instant
 * comparison decides differently depending on the hour.
 */
export function birthDateBounds(now: Date): { earliest: string; latest: string } {
  const todayKey = utcMidnight(now).toISOString().slice(0, 10);
  const oldest = new Date(`${todayKey}T00:00:00.000Z`);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_AGE_YEARS);
  return {
    earliest: shiftDateKey(oldest.toISOString().slice(0, 10), 1),
    latest: shiftDateKey(todayKey, -1),
  };
}

/**
 * @param original what the server currently holds, needed for the one rule
 * that depends on it: a birth date that already exists cannot be REMOVED
 * through this API (`birth_date: null` means "leave unchanged" and `""` is a
 * 422), so blanking the field has to be refused with an explanation instead of
 * being sent and bounced.
 */
export function validateProfileDraft(
  draft: ProfileDraft,
  original: AuthUser,
  now: Date,
): ProfileErrors {
  const errors: ProfileErrors = {};

  // Stricter than the server, which happily stores an empty name: the name is
  // what prefills every booking, and a blank one costs the guest a retype at
  // the worst moment. Being stricter can only ever prevent a round trip.
  if (draft.fullName.trim() === "") errors.fullName = "name_required";

  const birthDate = draft.birthDate.trim();
  if (birthDate === "") {
    if (original.birthDate) errors.birthDate = "birth_date_cannot_clear";
  } else {
    const parsed = parseCalendarDate(birthDate);
    if (!parsed) {
      // Не ключ даты — значит в черновике лежит то, что ГОСТЬ НАБРАЛ и что в
      // дату ещё не сложилось: календаря, который умел отдавать только
      // готовый день, с 2026-09-01 больше нет.
      //
      // «04.05.19» и «31.02.1992» — РАЗНЫЕ случаи, и человеку надо сказать
      // разное: первое не дописано, второго не существует. Различаем по числу
      // цифр, потому что маска «дд.мм.гггг» другого способа недобрать не
      // оставляет.
      errors.birthDate =
        birthDate.replace(/\D/g, "").length < FULL_BIRTH_DATE_DIGITS
          ? "birth_date_incomplete"
          : "birth_date_format";
    } else {
      // Date keys are compared as strings: "YYYY-MM-DD" sorts chronologically
      // by construction, and comparing the same representation the picker
      // hands out removes any chance of the two drifting through a Date.
      const { earliest, latest } = birthDateBounds(now);
      if (birthDate > latest) errors.birthDate = "birth_date_not_past";
      else if (birthDate < earliest) errors.birthDate = "birth_date_too_old";
    }
  }

  return errors;
}

/**
 * The PATCH body — only the keys that actually changed.
 *
 * Returns `null` when nothing did: the endpoint answers 422 to a body that
 * would patch nothing, and re-sending unchanged values is how a field this app
 * does not render gets overwritten.
 *
 * `city` is sent as `""` to clear it, never as null: on the wire null means
 * "leave this column alone" (Go `*string`).
 */
export function profilePatch(draft: ProfileDraft, original: AuthUser): ProfileUpdate | null {
  const patch: ProfileUpdate = {};
  const fullName = draft.fullName.trim();
  const city = draft.city.trim();
  const birthDate = draft.birthDate.trim();

  if (fullName !== original.fullName) patch.fullName = fullName;
  if (city !== (original.city ?? "")) patch.city = city;
  if (birthDate !== "" && birthDate !== (original.birthDate ?? "")) patch.birthDate = birthDate;

  return Object.keys(patch).length === 0 ? null : patch;
}

/**
 * Why a save failed, in the only four flavours the guest's next action differs
 * between.
 *
 * `session_expired` is reached ONLY after the HTTP client has already spent
 * its one refresh-and-retry (see HttpClient.send): a token that merely went
 * stale mid-edit is refreshed and the SAME body is resent, invisibly. So a 401
 * arriving here means the refresh token itself is dead — the guest has to sign
 * in again, and their typed edit must survive that, because nothing they typed
 * is the reason it failed.
 */
export type ProfileSaveFailure = "session_expired" | "rejected" | "offline" | "unknown";

export function classifyProfileSaveFailure(error: unknown): ProfileSaveFailure {
  if (!(error instanceof RepositoryError)) return "unknown";
  if (error.status === 401) return "session_expired";
  if (error.status === 422) return "rejected";
  // No status = the request never got an answer (offline, DNS, timeout).
  if (error.status === undefined) return "offline";
  return "unknown";
}
