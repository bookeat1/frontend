import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ОТКУДА КРУГ БЕРЁТ КАРТИНКУ после переезда на справочник кухонь.
 *
 * Порядок: ссылка из справочника → снимок, вшитый в сборку → фотография
 * заведения этой кухни. Второй шаг существует не «на всякий случай»: на бою
 * 2026-08-25 справочник не прислал `image_url` ни у одной из 14 кухонь, хотя
 * сами файлы в R2 уже лежат. Удали вшитые снимки — и ряд, где вчера были
 * картинки, станет рядом серых кругов.
 *
 * Третий случай — ссылка ЕСТЬ, но не загрузилась. Для гостя это неотличимо от
 * «картинки нет», поэтому и лечится тем же запасным снимком.
 */

// require(png) Node разобрать не может, поэтому вшитый снимок подменяется
// числом — ровно тем, чем его отдаёт Metro (идентификатор ресурса).
const BUNDLED = 4242;
const bundledFor = vi.fn<(id: string) => number | undefined>();
vi.mock("../cuisine-photos", () => ({ cuisinePhoto: (id: string) => bundledFor(id) }));

const { CuisineChip } = await import("../CuisineChip");

const DICTIONARY_URL = "https://cdn.example.test/cuisines/european.png";

/** Заглушка expo-image рисует настоящий <img>: локальный снимок (число) даёт
 * пустой src, ссылка — свой URL. По нему и видно, что именно взяли.
 *
 * Ищем узел напрямую, а не по роли `img`: картинка кухни ДЕКОРАТИВНАЯ (её
 * название уже сказано подписью и меткой кнопки), у неё пустой alt — и
 * ассистивные технологии её как изображение не видят. Это правильно, и тест
 * это правило не должен ломать. */
function image(): HTMLImageElement {
  const node = document.querySelector("img");
  if (!node) throw new Error("картинки в кружке кухни нет вовсе");
  return node;
}

function imageSrc(): string {
  return image().getAttribute("src") ?? "";
}

beforeEach(() => {
  bundledFor.mockReturnValue(undefined);
});

describe("картинка кружка кухни", () => {
  it("берёт ссылку из справочника, когда она есть", () => {
    bundledFor.mockReturnValue(BUNDLED);
    render(
      <CuisineChip
        cuisine={{ id: "european", name: "Европейская", imageUrl: DICTIONARY_URL }}
        onSelect={vi.fn()}
      />,
    );

    expect(imageSrc()).toBe(DICTIONARY_URL);
  });

  it("без ссылки берёт вшитый снимок — сегодня это боевой случай", () => {
    bundledFor.mockReturnValue(BUNDLED);
    render(
      <CuisineChip cuisine={{ id: "european", name: "Европейская" }} onSelect={vi.fn()} />,
    );

    expect(bundledFor).toHaveBeenCalledWith("european");
    // Локальный ресурс — не URL: важно, что картинка есть и это не заглушка.
    expect(imageSrc()).toBe("");
    expect(image()).toBeTruthy();
  });

  it("ссылка не загрузилась — подставляется вшитый снимок, а не серый круг", () => {
    bundledFor.mockReturnValue(BUNDLED);
    render(
      <CuisineChip
        cuisine={{ id: "european", name: "Европейская", imageUrl: DICTIONARY_URL }}
        onSelect={vi.fn()}
      />,
    );

    expect(imageSrc()).toBe(DICTIONARY_URL);
    fireEvent.error(image());

    expect(imageSrc()).toBe("");
    // Название кухни на месте: падает картинка, а не чип целиком.
    expect(screen.getByText("Европейская")).toBeTruthy();
  });

  it("ни ссылки, ни вшитого снимка — остаётся фотография заведения этой кухни", () => {
    render(
      <CuisineChip
        cuisine={{ id: "japanese", name: "Японская" }}
        onSelect={vi.fn()}
        photoUri="https://cdn.example.test/venues/sushi.jpg"
      />,
    );

    // Четыре кухни справочника (authors/japanese/georgian/pan_asian) не имеют
    // картинки ни в R2, ни в сборке — их круг держится на этом источнике.
    expect(imageSrc()).toContain("sushi.jpg");
  });

  it("кухня остаётся кнопкой с названием, какой бы источник ни сработал", () => {
    const onSelect = vi.fn();
    render(
      <CuisineChip
        cuisine={{ id: "kazakh", name: "Казахская", imageUrl: DICTIONARY_URL }}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Казахская/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "kazakh", name: "Казахская" }),
    );
  });
});
