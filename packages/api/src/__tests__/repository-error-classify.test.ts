import { describe, expect, it } from "vitest";
import { RepositoryError } from "../repository";

/**
 * The empty/error state screens branch on these three getters to choose
 * between «Нет подключения» (offline), «Идут технические работы» (503) and the
 * generic «Не удалось загрузить». Getting the classification wrong shows the
 * wrong screen — and the offline/malformed cases are byte-identical on `status`
 * (both `undefined`), so `networkFailure` is the only thing that tells them
 * apart. Lock it here.
 */
describe("RepositoryError offline / maintenance classification", () => {
  it("flags a transport failure (no response) as offline", () => {
    const error = new RepositoryError(
      "Network error requesting /feed",
      new Error("Network request failed"),
      undefined, // status — none, the request never reached the server
      undefined,
      undefined,
      undefined,
      true, // networkFailure
    );
    expect(error.isOffline).toBe(true);
    expect(error.isMaintenance).toBe(false);
  });

  it("flags HTTP 503 as maintenance, not offline", () => {
    const error = new RepositoryError("Server error 503", undefined, 503);
    expect(error.isMaintenance).toBe(true);
    expect(error.isOffline).toBe(false);
  });

  it("does not treat a malformed body (status undefined, no network flag) as offline", () => {
    // Same missing `status` as a transport failure, but the server DID answer —
    // this must fall through to the generic failure, not the offline screen.
    const error = new RepositoryError("Empty or malformed response from /feed", new Error("bad json"));
    expect(error.isOffline).toBe(false);
    expect(error.isMaintenance).toBe(false);
  });

  it("treats a generic 500 as neither offline nor maintenance", () => {
    const error = new RepositoryError("Server error 500", undefined, 500);
    expect(error.isOffline).toBe(false);
    expect(error.isMaintenance).toBe(false);
  });
});
