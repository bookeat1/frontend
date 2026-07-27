import { describe, expect, it } from "vitest";

import { classifyGuideFailure } from "../admin/guide-failure";
import { RepositoryError } from "../repository";

/**
 * REGRESSION GUARD — a refused guide write must not be collapsed into one
 * "не удалось сохранить".
 *
 * The editor's writes are refused for reasons that need OPPOSITE actions, and
 * the human text on the wire is the same generic English string for all of them
 * (response.classify builds it from the sentinel alone): every 409 says "already
 * exists", every 422 says "validation failed".
 *
 * What breaks for a real person if this regresses:
 *
 *  - The reorder is the dangerous one. It is produced by a drag, not by a
 *    conscious "submit". If a refused reorder (422 guide_order_mismatch, nothing
 *    written, the screen is stale because somebody attached a venue in another
 *    tab) is shown as a generic failure, the editor drags again on top of data
 *    that no longer matches the server — and keeps being refused, with no hint
 *    that the fix is to reload.
 *  - A timeout on the SAME endpoint is the opposite situation: the new order may
 *    well have committed. Telling the editor "порядок не сохранён" there is a
 *    claim we cannot support, and it invites them to re-drag on top of a write
 *    that landed.
 *  - Publishing an empty collection (422 guide_collection_empty) is fixed by
 *    attaching a venue, and there is no way to guess that from "validation
 *    failed".
 *
 * The narrow codes come from domain.WithCode in the gastroguide usecase and
 * repository. Everything the server does NOT label narrowly must stay "we do not
 * know", never "nothing happened".
 */

function err(status: number | undefined, code?: string): RepositoryError {
  return new RepositoryError("boom", undefined, status, undefined, code);
}

describe("classifyGuideFailure", () => {
  it("а устаревший порядок — это «ничего не записано, перезагрузите экран»", () => {
    const failure = classifyGuideFailure(err(422, "guide_order_mismatch"));
    expect(failure.kind).toBe("order_stale");
    expect(failure.applied).toBe(false);
    expect(failure.needsReload).toBe(true);
  });

  it("а обрыв связи на том же запросе — это «мы не знаем», а не «не сохранилось»", () => {
    for (const error of [err(undefined), err(500), err(502), new Error("network"), undefined]) {
      const failure = classifyGuideFailure(error);
      expect(failure.kind).toBe("unknown");
      // The distinction the whole module exists for: `false` is a claim about
      // the database, and here we have no grounds for it.
      expect(failure.applied).toBe("unknown");
      expect(failure.needsReload).toBe(true);
    }
  });

  it("а занятый слаг чинится в форме, а не перезагрузкой", () => {
    const failure = classifyGuideFailure(err(409, "guide_slug_taken"));
    expect(failure.kind).toBe("slug_taken");
    expect(failure.applied).toBe(false);
    expect(failure.needsReload).toBe(false);
  });

  it("а пустая подборка при публикации — отдельный случай со своим действием", () => {
    const failure = classifyGuideFailure(err(422, "guide_collection_empty"));
    expect(failure.kind).toBe("collection_empty");
    expect(failure.applied).toBe(false);
    expect(failure.needsReload).toBe(false);
  });

  it("а уже добавленное заведение значит, что список на экране устарел", () => {
    const failure = classifyGuideFailure(err(409, "guide_venue_already_attached"));
    expect(failure.kind).toBe("venue_already_attached");
    expect(failure.needsReload).toBe(true);
  });

  it("а узкий код важнее статуса, с которым он приехал", () => {
    // A server build that ever moves guide_order_mismatch from 422 to 409 must
    // not silently turn a "reload" into an "unknown".
    expect(classifyGuideFailure(err(409, "guide_order_mismatch")).kind).toBe("order_stale");
    expect(classifyGuideFailure(err(500, "guide_slug_taken")).kind).toBe("slug_taken");
  });

  it("а 403 отличается от 422: гастрогид просто не для этой роли", () => {
    expect(classifyGuideFailure(err(403)).kind).toBe("forbidden");
    expect(classifyGuideFailure(err(401)).kind).toBe("unauthorized");
    expect(classifyGuideFailure(err(404)).kind).toBe("not_found");
    // A bare 422 is still a refusal: the server returns ErrValidation before a
    // commit, so "nothing changed" is a fact here rather than a guess.
    expect(classifyGuideFailure(err(422)).applied).toBe(false);
  });

  it("а необъявленный 409 без кода — это «мы не знаем», а не «уже существует»", () => {
    // What a server build older than this feature sends.
    const failure = classifyGuideFailure(err(409));
    expect(failure.kind).toBe("unknown");
    expect(failure.applied).toBe("unknown");
  });
});
