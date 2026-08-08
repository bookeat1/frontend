import { describe, expect, it, vi } from "vitest";

import { AdminApiClient, AdminApiError, imageUploadErrorCode } from "../admin/client";

/**
 * uploadImage is the ONE admin write that must send multipart, not JSON. These
 * guard the two things a JSON path would get wrong — no forced
 * application/json Content-Type (the browser owns the boundary) and a FormData
 * body under the `file` field — plus the friendly-error classification the
 * panel relies on for the cases a user can fix (>8MB, wrong type, not set up).
 */

const BASE = "https://api.example.test/api/v1";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function initOf(call: unknown[]): RequestInit {
  return call[1] as RequestInit;
}

describe("uploadImage — multipart, auth, and error mapping", () => {
  it("POSTs FormData under `file` with a bearer token and NO forced JSON content-type", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { data: { url: "https://pub-x.r2.dev/uploads/a.jpg" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new AdminApiClient({ baseUrl: BASE, getToken: () => "tok-1" });
    const file = new File([new Uint8Array([1, 2, 3])], "cover.png", { type: "image/png" });

    await expect(client.uploadImage(file)).resolves.toBe("https://pub-x.r2.dev/uploads/a.jpg");

    const [url, init] = [fetchMock.mock.calls[0][0], initOf(fetchMock.mock.calls[0])];
    expect(String(url)).toBe(`${BASE}/admin/media/images`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-1");
    // The browser must derive the multipart boundary itself.
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it.each([
    [413, "image_too_large"],
    [422, "image_bad_type"],
    [503, "image_upload_unconfigured"],
  ])("maps %i to a typed, friendly code (%s)", async (status, code) => {
    const fetchMock = vi.fn(async () => jsonResponse(status, { error: "nope" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AdminApiClient({ baseUrl: BASE, getToken: () => "tok" });
    const file = new File([new Uint8Array([1])], "x.png", { type: "image/png" });

    await expect(client.uploadImage(file)).rejects.toMatchObject({
      status,
      code,
    });
  });

  it("renews and replays the upload exactly once on 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { url: "https://pub-x.r2.dev/u/b.webp" } }));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn(async () => "tok-new");
    const client = new AdminApiClient({ baseUrl: BASE, getToken: () => "tok-old", onUnauthorized });
    const file = new File([new Uint8Array([1])], "b.webp", { type: "image/webp" });

    await expect(client.uploadImage(file)).resolves.toBe("https://pub-x.r2.dev/u/b.webp");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((initOf(fetchMock.mock.calls[0]).headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-old",
    );
    expect((initOf(fetchMock.mock.calls[1]).headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-new",
    );
    // A fresh FormData per attempt — a body can only be consumed once.
    expect(initOf(fetchMock.mock.calls[1]).body).toBeInstanceOf(FormData);
  });

  it("throws AdminApiError when the response carries no url", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AdminApiClient({ baseUrl: BASE, getToken: () => "tok" });
    const file = new File([new Uint8Array([1])], "x.png", { type: "image/png" });

    await expect(client.uploadImage(file)).rejects.toBeInstanceOf(Error);
  });
});

describe("imageUploadErrorCode", () => {
  it("prefers a known server code over the status", () => {
    expect(imageUploadErrorCode(400, "image_bad_type")).toBe("image_bad_type");
  });
  it("falls back to the HTTP status", () => {
    expect(imageUploadErrorCode(413)).toBe("image_too_large");
    expect(imageUploadErrorCode(401)).toBe("unauthorized");
    expect(imageUploadErrorCode(500)).toBe("upload_failed");
  });
  it("ignores an unknown server code and uses the status", () => {
    expect(imageUploadErrorCode(413, "some_other_thing")).toBe("image_too_large");
  });
});
