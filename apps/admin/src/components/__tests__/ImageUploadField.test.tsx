import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Виджет «Загрузить фото»: что именно уезжает на сервер.
 *
 * Правка 2026-08-25: файл ужимается и перекодируется в WebP ПРЯМО В БРАУЗЕРЕ,
 * потому что уменьшить его на отдаче негде — публичный домен R2 не умеет
 * преобразований по адресу. Отсюда два правила, которые здесь и закреплены:
 *
 *   1. ужатие — улучшение, а не условие: браузер, который так не умеет
 *      (как этот jsdom — в нём нет ни createImageBitmap, ни кодека WebP),
 *      обязан загрузить ИСХОДНЫЙ файл, а не показать ошибку;
 *   2. когда ужатие получилось — уезжает именно WebP, а не оригинал.
 */

const uploadImage = vi.fn<(file: File | Blob) => Promise<string>>();

vi.mock("@/lib/api", () => ({ apiClient: { uploadImage } }));

const { ImageUploadField } = await import("../ui/ImageUploadField");

function renderField(onChange = vi.fn(), maxEdge?: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ImageUploadField value="" onChange={onChange} label="Картинка" maxEdge={maxEdge} />
    </QueryClientProvider>,
  );
  return onChange;
}

/** Настоящий <input type="file"> виджета: он спрятан от глаз, но это он. */
function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("поля выбора файла нет");
  return input as HTMLInputElement;
}

function pick(file: File): void {
  fireEvent.change(fileInput(), { target: { files: [file] } });
}

const png = () =>
  new File([new Uint8Array(400_000)], "european.png", { type: "image/png" });

afterEach(() => {
  cleanup();
  uploadImage.mockReset();
  vi.unstubAllGlobals();
});

describe("что уезжает на сервер", () => {
  it("браузер не умеет ужимать — уходит исходный файл, загрузка НЕ падает", async () => {
    uploadImage.mockResolvedValue("https://cdn.example.test/a.png");
    const onChange = renderField();

    const original = png();
    pick(original);

    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    expect(uploadImage.mock.calls[0][0]).toBe(original);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("https://cdn.example.test/a.png"),
    );
  });

  it("ужатие получилось — уезжает WebP, а не оригинал", async () => {
    uploadImage.mockResolvedValue("https://cdn.example.test/a.webp");
    stubImagePipeline({ width: 384, height: 384, encodedBytes: 19_000 });
    renderField();

    pick(png());

    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    const sent = uploadImage.mock.calls[0][0] as File;
    expect(sent.type).toBe("image/webp");
    expect(sent.size).toBe(19_000);
    expect(sent.name).toBe("european.webp");
  });

  it("файл не той природы отвергается до всякой отправки", async () => {
    renderField();

    pick(new File([new Uint8Array(10)], "doc.pdf", { type: "application/pdf" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("тяжёлый снимок с телефона проходит: лимит считается ПОСЛЕ ужатия", async () => {
    // 12 МБ оригинала — старый порядок проверок отверг бы его как «больше 8 МБ»,
    // хотя после ужатия это 20 КБ.
    uploadImage.mockResolvedValue("https://cdn.example.test/a.webp");
    stubImagePipeline({ width: 4000, height: 3000, encodedBytes: 20_000 });
    renderField();

    pick(new File([new Uint8Array(12 * 1024 * 1024)], "IMG_0042.jpeg", { type: "image/jpeg" }));

    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/** Подменяет ровно то, чего нет в jsdom: декодер картинки и кодировщик канваса. */
function stubImagePipeline(opts: { width: number; height: number; encodedBytes: number }): void {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: opts.width, height: opts.height, close: vi.fn() })),
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage: vi.fn(),
    }),
    toBlob: (cb: (b: Blob | null) => void) =>
      cb(new Blob([new Uint8Array(opts.encodedBytes)], { type: "image/webp" })),
  };
  // Подменяем ТОЛЬКО createElement("canvas"): подмена всего `document`
  // ломает React — он теряет настоящий body и падает на appendChild.
  const real = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
    tag === "canvas" ? (canvas as unknown as HTMLElement) : real(tag),
  );
}
