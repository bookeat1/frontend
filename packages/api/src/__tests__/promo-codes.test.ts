import { describe, expect, it } from "vitest";

import { RepositoryError } from "../repository";
import { canTransitionPromoCodeStatus, classifyPromoCodeFailure } from "../admin/promo-codes";

/**
 * Промокоды марафона (миграция 0108) — договорённость с
 * `internal/transport/rest/promocodes/admin.go` и `domain.PromoCode`.
 */

describe("classifyPromoCodeFailure", () => {
  it("узнаёт узкие коды сервера раньше общего статуса", () => {
    expect(
      classifyPromoCodeFailure(
        new RepositoryError("refused", undefined, 422, "refused", "promo_code_activated"),
      ).kind,
    ).toBe("activated");
    expect(
      classifyPromoCodeFailure(
        new RepositoryError("refused", undefined, 422, "refused", "promo_code_bad_transition"),
      ).kind,
    ).toBe("bad_transition");
  });

  it("дублирующийся код — 409", () => {
    const failure = classifyPromoCodeFailure(new RepositoryError("dup", undefined, 409));
    expect(failure.kind).toBe("duplicate");
    expect(failure.applied).toBe(false);
  });

  it("общий 422 без узкого кода — refused", () => {
    expect(classifyPromoCodeFailure(new RepositoryError("bad", undefined, 422)).kind).toBe(
      "refused",
    );
  });

  it("404/403/401 сопоставлены как есть", () => {
    expect(classifyPromoCodeFailure(new RepositoryError("x", undefined, 404)).kind).toBe(
      "not_found",
    );
    expect(classifyPromoCodeFailure(new RepositoryError("x", undefined, 403)).kind).toBe(
      "forbidden",
    );
    expect(classifyPromoCodeFailure(new RepositoryError("x", undefined, 401)).kind).toBe(
      "unauthorized",
    );
  });

  it("сеть/5xx — unknown, и тогда неизвестно, применилось ли", () => {
    const failure = classifyPromoCodeFailure(new RepositoryError("offline"));
    expect(failure.kind).toBe("unknown");
    expect(failure.applied).toBe("unknown");
  });

  it("не RepositoryError — тоже unknown, а не падает", () => {
    expect(classifyPromoCodeFailure(new Error("boom")).kind).toBe("unknown");
  });
});

describe("canTransitionPromoCodeStatus", () => {
  it("draft уходит в active или archived, но не в paused напрямую", () => {
    expect(canTransitionPromoCodeStatus("draft", "active")).toBe(true);
    expect(canTransitionPromoCodeStatus("draft", "archived")).toBe(true);
    expect(canTransitionPromoCodeStatus("draft", "paused")).toBe(false);
  });

  it("active и paused переключаются друг в друга", () => {
    expect(canTransitionPromoCodeStatus("active", "paused")).toBe(true);
    expect(canTransitionPromoCodeStatus("paused", "active")).toBe(true);
  });

  it("archived — терминальный, обратно хода нет", () => {
    expect(canTransitionPromoCodeStatus("archived", "active")).toBe(false);
    expect(canTransitionPromoCodeStatus("archived", "draft")).toBe(false);
  });

  it("остаться в том же статусе разрешено всегда, архив включая", () => {
    expect(canTransitionPromoCodeStatus("archived", "archived")).toBe(true);
    expect(canTransitionPromoCodeStatus("active", "active")).toBe(true);
  });
});
