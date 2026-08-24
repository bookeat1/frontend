import { RepositoryError } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { describe, expect, it } from "vitest";
import { classifyOtpRequestFailure, describeOtpRequestError } from "../otp-error-copy";

/**
 * REGRESSION GUARD — «Проверьте соединение» used to be the answer to FOUR
 * different failures of `POST /auth/otp/request`: a client-side timeout (the
 * code had actually been sent), a 5xx, a malformed body and being genuinely
 * offline. Only the last of them is about the guest's connection, and the first
 * one is the one that used to leave a guest holding a code with nowhere to type
 * it. Each branch is locked here.
 */

const copy = getDictionary("ru").auth;
const FALLBACK_SECONDS = 60;

/** A transport failure exactly as http-client.ts builds it. */
function transportFailure({ timedOut }: { timedOut: boolean }): RepositoryError {
  return new RepositoryError(
    timedOut ? "Request to /auth/otp/request timed out after 20000ms" : "Network error",
    new Error("cause"),
    undefined, // no status — the request never got an answer
    undefined,
    undefined,
    undefined,
    true, // networkFailure: a timeout carries it too
    timedOut,
  );
}

describe("describeOtpRequestError", () => {
  it("429: shows the server's own Retry-After, not a guess", () => {
    const error = new RepositoryError("rate limited", undefined, 429, undefined, undefined, 12);
    expect(describeOtpRequestError(error, copy, FALLBACK_SECONDS)).toBe(copy.errorRateLimited(12));
  });

  it("429 without a Retry-After header: falls back to the resend cooldown", () => {
    const error = new RepositoryError("rate limited", undefined, 429);
    expect(describeOtpRequestError(error, copy, FALLBACK_SECONDS)).toBe(
      copy.errorRateLimited(FALLBACK_SECONDS),
    );
  });

  it("422: the per-phone budget, not a connection problem", () => {
    const error = new RepositoryError("validation failed", undefined, 422);
    expect(describeOtpRequestError(error, copy, FALLBACK_SECONDS)).toBe(copy.errorTooOften);
  });

  it("timeout: says the code may have arrived — never 'check your connection'", () => {
    const message = describeOtpRequestError(transportFailure({ timedOut: true }), copy, FALLBACK_SECONDS);
    expect(message).toBe(copy.errorTimedOut);
    expect(message).not.toBe(copy.errorDescription);
  });

  it("timeout wins over offline even though the error carries both flags", () => {
    const error = transportFailure({ timedOut: true });
    // The precondition that makes the ordering necessary.
    expect(error.isOffline).toBe(true);
    expect(error.isTimeout).toBe(true);
    expect(describeOtpRequestError(error, copy, FALLBACK_SECONDS)).toBe(copy.errorTimedOut);
  });

  it("500: blames our side, not the guest's connection", () => {
    const error = new RepositoryError("Server error 500", undefined, 500);
    expect(describeOtpRequestError(error, copy, FALLBACK_SECONDS)).toBe(copy.errorServerFailure);
  });

  it("503: still a server failure", () => {
    const error = new RepositoryError("Server error 503", undefined, 503);
    expect(describeOtpRequestError(error, copy, FALLBACK_SECONDS)).toBe(copy.errorServerFailure);
  });

  it("genuinely offline: keeps the connection wording", () => {
    expect(describeOtpRequestError(transportFailure({ timedOut: false }), copy, FALLBACK_SECONDS)).toBe(
      copy.errorDescription,
    );
  });

  it("anything unclassified (malformed body, non-RepositoryError) falls back", () => {
    const malformed = new RepositoryError("Empty or malformed response from /auth/otp/request");
    expect(describeOtpRequestError(malformed, copy, FALLBACK_SECONDS)).toBe(copy.errorDescription);
    expect(describeOtpRequestError(new Error("boom"), copy, FALLBACK_SECONDS)).toBe(copy.errorDescription);
  });

  it("every branch produces a DIFFERENT sentence", () => {
    const sentences = new Set([
      describeOtpRequestError(new RepositoryError("x", undefined, 422), copy, FALLBACK_SECONDS),
      describeOtpRequestError(transportFailure({ timedOut: true }), copy, FALLBACK_SECONDS),
      describeOtpRequestError(new RepositoryError("x", undefined, 500), copy, FALLBACK_SECONDS),
      describeOtpRequestError(transportFailure({ timedOut: false }), copy, FALLBACK_SECONDS),
    ]);
    expect(sentences.size).toBe(4);
  });
});

/**
 * ВТОРАЯ ЧАСТЬ РЕШЕНИЯ: не только «что сказать», но и «пускать ли дальше».
 *
 * Ровно один отказ оставляет гостю что вводить — наш собственный таймаут: код на
 * сервере создаётся примерно через секунду после прихода запроса и переживает
 * оборванный запрос. Все остальные означают, что кода нет, и увести на поле ввода
 * значило бы посадить человека перед полем, которое никогда ничего не примет.
 */
describe("classifyOtpRequestFailure — можно ли продолжить ввод кода", () => {
  it("таймаут: ведём на шаг кода", () => {
    const failure = classifyOtpRequestFailure(transportFailure({ timedOut: true }), copy, FALLBACK_SECONDS);
    expect(failure.canStillEnterCode).toBe(true);
    expect(failure.message).toBe(copy.errorTimedOut);
  });

  it.each([
    ["офлайн", transportFailure({ timedOut: false })],
    ["422 (лимит по номеру)", new RepositoryError("validation failed", undefined, 422)],
    ["429 (лимит по IP)", new RepositoryError("rate limited", undefined, 429, undefined, undefined, 12)],
    ["500", new RepositoryError("Server error 500", undefined, 500)],
    ["503", new RepositoryError("Server error 503", undefined, 503)],
    ["битый ответ", new RepositoryError("Empty or malformed response")],
    ["не RepositoryError", new Error("boom")],
  ])("%s: на шаг кода НЕ ведём — вводить нечего", (_name, error) => {
    expect(classifyOtpRequestFailure(error, copy, FALLBACK_SECONDS).canStillEnterCode).toBe(false);
  });

  it("describeOtpRequestError говорит ровно то же, что и классификатор", () => {
    const cases: unknown[] = [
      transportFailure({ timedOut: true }),
      transportFailure({ timedOut: false }),
      new RepositoryError("x", undefined, 422),
      new RepositoryError("x", undefined, 429, undefined, undefined, 7),
      new RepositoryError("x", undefined, 500),
      new Error("boom"),
    ];
    for (const error of cases) {
      expect(describeOtpRequestError(error, copy, FALLBACK_SECONDS)).toBe(
        classifyOtpRequestFailure(error, copy, FALLBACK_SECONDS).message,
      );
    }
  });
});
