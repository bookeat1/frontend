import { RepositoryError, type AuthUser } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import {
  birthDateBounds,
  classifyProfileSaveFailure,
  profilePatch,
  validateProfileDraft,
  type ProfileDraft,
} from "../profile-edit";

/**
 * REGRESSION GUARD — «сохранено», а потом отказ сервера.
 *
 * The profile editor sends `PATCH /users/me`, and exactly one of its fields is
 * validated server-side: `birth_date` must parse as "YYYY-MM-DD", be strictly
 * in the past and imply an age of no more than 120 years
 * (internal/usecase/users/facade.go). A client that does not check the same
 * thing shows a spinner, then a red line the guest cannot act on — for a
 * typo'd year they had no reason to suspect.
 *
 * Two traps are pinned here on purpose, because both are invisible until a
 * real guest hits them:
 *
 *  1. The server compares a DATE (sent as midnight UTC) against an INSTANT.
 *     In Almaty, UTC+5, "today" is still yesterday in UTC until 05:00, so the
 *     same input is accepted in the morning and refused in the afternoon. The
 *     client refuses both boundary days, which can only ever be safe.
 *  2. `birth_date` cannot be CLEARED through this API at all: null means
 *     "leave unchanged" and "" is a 422. Blanking the field has to be refused
 *     with an explanation instead of being sent.
 *
 * Boundaries, not middles: for every rule the day before, the day itself and
 * the day after are asserted.
 */

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u-1",
    email: "",
    fullName: "Дамир",
    phone: "+77010000000",
    city: null,
    avatarUrl: null,
    birthDate: null,
    ...overrides,
  };
}

function draft(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return { fullName: "Дамир", city: "", birthDate: "", ...overrides };
}

/** A fixed "now" so the boundary days are literals a reader can check by eye.
 * 12:00 UTC — mid-day in UTC, i.e. the half of the day where the server WOULD
 * accept today's date; the client still refuses it. */
const NOW = new Date("2026-07-27T12:00:00.000Z");

describe("дата рождения — границы, которые проверяет сервер", () => {
  it("вчера принимается", () => {
    expect(validateProfileDraft(draft({ birthDate: "2026-07-26" }), user(), NOW)).toEqual({});
  });

  it("сегодня отклоняется на клиенте, потому что сервер отклонит его половину суток", () => {
    expect(validateProfileDraft(draft({ birthDate: "2026-07-27" }), user(), NOW)).toEqual({
      birthDate: "birth_date_not_past",
    });
  });

  it("завтра отклоняется", () => {
    expect(validateProfileDraft(draft({ birthDate: "2026-07-28" }), user(), NOW)).toEqual({
      birthDate: "birth_date_not_past",
    });
  });

  it("ровно 120 лет назад отклоняется — сервер сравнивает с моментом, а не с датой", () => {
    expect(validateProfileDraft(draft({ birthDate: "1906-07-27" }), user(), NOW)).toEqual({
      birthDate: "birth_date_too_old",
    });
  });

  it("на день позже границы в 120 лет принимается", () => {
    expect(validateProfileDraft(draft({ birthDate: "1906-07-28" }), user(), NOW)).toEqual({});
  });

  it("на день раньше границы отклоняется", () => {
    expect(validateProfileDraft(draft({ birthDate: "1906-07-26" }), user(), NOW)).toEqual({
      birthDate: "birth_date_too_old",
    });
  });

  it("несуществующий день месяца не проезжает как 3 марта", () => {
    // new Date("2026-02-31") silently becomes 3 March; the server's time.Parse
    // refuses it. Without the round-trip check the guest would be told the
    // wrong date was saved.
    expect(validateProfileDraft(draft({ birthDate: "2026-02-31" }), user(), NOW)).toEqual({
      birthDate: "birth_date_format",
    });
  });

  it("другой формат отклоняется до запроса", () => {
    for (const value of ["04.05.1990", "1990-5-4", "1990", "вчера"]) {
      expect(validateProfileDraft(draft({ birthDate: value }), user(), NOW)).toEqual({
        birthDate: "birth_date_format",
      });
    }
  });
});

/**
 * REGRESSION GUARD — календарь предлагает день, который форма потом отвергает.
 *
 * Дату рождения теперь не набирают, а выбирают в календаре, и календарь
 * получает диапазон отсюда же. Если `birthDateBounds` и `validateProfileDraft`
 * разойдутся хотя бы на день, гость получит красную строку за то, что нажал на
 * активную клетку — то есть за подчинение интерфейсу. Здесь эти два места
 * сверяются друг с другом на обеих границах.
 */
describe("границы календаря совпадают с тем, что примет форма", () => {
  it("диапазон — от «120 лет назад плюс день» до вчера", () => {
    expect(birthDateBounds(NOW)).toEqual({ earliest: "1906-07-28", latest: "2026-07-26" });
  });

  it("обе крайние даты диапазона форма принимает", () => {
    const { earliest, latest } = birthDateBounds(NOW);
    expect(validateProfileDraft(draft({ birthDate: earliest }), user(), NOW)).toEqual({});
    expect(validateProfileDraft(draft({ birthDate: latest }), user(), NOW)).toEqual({});
  });

  it("день сразу за каждой границей форма отклоняет — значит календарь его гасит", () => {
    const { earliest, latest } = birthDateBounds(NOW);
    const dayBefore = (key: string) => {
      const d = new Date(`${key}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    };
    const dayAfter = (key: string) => {
      const d = new Date(`${key}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };

    expect(validateProfileDraft(draft({ birthDate: dayBefore(earliest) }), user(), NOW)).toEqual({
      birthDate: "birth_date_too_old",
    });
    expect(validateProfileDraft(draft({ birthDate: dayAfter(latest) }), user(), NOW)).toEqual({
      birthDate: "birth_date_not_past",
    });
  });
});

describe("дату рождения нельзя удалить — у API нет такой возможности", () => {
  it("очистка заполненной даты объясняется, а не отправляется", () => {
    const current = user({ birthDate: "1990-05-04" });
    expect(validateProfileDraft(draft({ birthDate: "" }), current, NOW)).toEqual({
      birthDate: "birth_date_cannot_clear",
    });
  });

  it("пустое поле у того, кто дату и не указывал, — это не ошибка", () => {
    expect(validateProfileDraft(draft({ birthDate: "" }), user(), NOW)).toEqual({});
  });
});

describe("имя", () => {
  it("пустое имя не отправляется: им подставляются брони", () => {
    expect(validateProfileDraft(draft({ fullName: "   " }), user(), NOW)).toEqual({
      fullName: "name_required",
    });
  });
});

describe("тело PATCH — только то, что правда изменилось", () => {
  it("неизменённый черновик не даёт запроса вообще", () => {
    const current = user({ fullName: "Дамир", city: "Алматы", birthDate: "1990-05-04" });
    const same = draft({ fullName: "Дамир", city: "Алматы", birthDate: "1990-05-04" });
    expect(profilePatch(same, current)).toBeNull();
  });

  it("одно изменённое поле не тащит за собой остальные", () => {
    const current = user({ fullName: "Дамир", city: "Алматы", birthDate: "1990-05-04" });
    expect(profilePatch(draft({ fullName: "Дамир С.", city: "Алматы", birthDate: "1990-05-04" }), current)).toEqual({
      fullName: "Дамир С.",
    });
  });

  it("город очищается пустой строкой, а не null — null сервер считает «не трогать»", () => {
    const current = user({ city: "Алматы" });
    expect(profilePatch(draft({ city: "" }), current)).toEqual({ city: "" });
  });

  it("пустая дата рождения не попадает в тело запроса", () => {
    // "" would be a 422 (time.Parse), null would mean "unchanged" — so the key
    // must simply be absent.
    const current = user({ fullName: "Дамир" });
    expect(profilePatch(draft({ fullName: "Дамир С.", birthDate: "" }), current)).toEqual({
      fullName: "Дамир С.",
    });
  });
});

describe("почему сохранение не удалось", () => {
  it("401 после того, как клиент уже попробовал обновить токен, — это конец сессии", () => {
    expect(classifyProfileSaveFailure(new RepositoryError("no", undefined, 401))).toBe(
      "session_expired",
    );
  });

  it("422 — сервер не принял данные", () => {
    expect(classifyProfileSaveFailure(new RepositoryError("no", undefined, 422))).toBe("rejected");
  });

  it("ответа не было вовсе — это связь, а не данные", () => {
    expect(classifyProfileSaveFailure(new RepositoryError("Network error"))).toBe("offline");
  });

  it("5xx не выдаём за проблему со связью", () => {
    expect(classifyProfileSaveFailure(new RepositoryError("no", undefined, 500))).toBe("unknown");
  });
});
