import type { Cuisine } from "@bookeat/api";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ряд «Выберите кухню».
 *
 * 21.08.2026 владелец сообщил, что блока кухонь на главной фактически нет.
 * Причина была не в вёрстке: кухня показывалась ТОЛЬКО если её снимок лежал в
 * самом приложении, а таких снимков было три на девять кухонь каталога.
 *
 * Здесь проверяется новое правило: снимок берётся у реального заведения этой
 * кухни, и кухня пропадает лишь тогда, когда фотографии нет вообще нигде.
 */

const cuisines: { data?: Cuisine[]; isLoading: boolean; isError: boolean } = {
  data: [],
  isLoading: false,
  isError: false,
};
let photos = new Map<string, string>();

vi.mock("../use-explore-data", () => ({
  useExploreCuisines: () => cuisines,
  useCuisinePhotos: () => photos,
}));

// Снимки кухонь тянутся через require(jpg) — Node пытается РАЗОБРАТЬ картинку
// как модуль и падает с «Invalid or unexpected token». Тот же приём, что с
// шапкой гастрогида: подменяется только источник картинки, правило показа
// остаётся настоящим.
vi.mock("../cuisine-photos", () => ({
  cuisinePhoto: (id: string) => (id === "казахская" ? 1 : undefined),
}));

// Ряд рисует FlatList; в тестовой среде достаточно простого списка.
vi.mock("../CardStrip", () => ({
  CardStrip: ({ data, renderItem }: { data: unknown[]; renderItem: (arg: unknown) => unknown }) => (
    <div>{data.map((item, index) => <div key={index}>{renderItem({ item }) as never}</div>)}</div>
  ),
}));

const { CuisineSection } = await import("../CuisineSection");

beforeEach(() => {
  cuisines.isLoading = false;
  cuisines.isError = false;
  photos = new Map();
});

describe("ряд кухонь на главной", () => {
  it("кухня без своего снимка показывается, если фото есть у заведения каталога", async () => {
    // «Европейская» — самая частая кухня каталога, и своего снимка в
    // приложении у неё нет.
    cuisines.data = [{ id: "европейская", name: "Европейская" }];
    photos = new Map([["европейская", "https://cdn.example/venue.jpg"]]);

    render(<CuisineSection onPickCuisine={vi.fn()} />);

    expect(await screen.findByText("Европейская")).toBeTruthy();
  });

  it("кухня без снимка где бы то ни было в ряд не попадает", async () => {
    cuisines.data = [{ id: "турецкая", name: "Турецкая" }];

    render(<CuisineSection onPickCuisine={vi.fn()} />);

    await waitFor(() => expect(screen.queryByText("Турецкая")).toBeNull());
  });

  it("свой снимок в приложении работает и без каталога", async () => {
    // «Казахская» — одна из трёх, чьи снимки лежат в самом приложении.
    cuisines.data = [{ id: "казахская", name: "Казахская" }];

    render(<CuisineSection onPickCuisine={vi.fn()} />);

    expect(await screen.findByText("Казахская")).toBeTruthy();
  });

  it("ссылки из справочника хватает: ни своего снимка, ни фото заведения не нужно", async () => {
    // Переезд на справочник (2026-08-25): у кухни есть `imageUrl` — и этого
    // достаточно, чтобы круг появился, даже если в сборке снимка нет.
    cuisines.data = [
      { id: "japanese", name: "Японская", imageUrl: "https://cdn.example/cuisines/japanese.png" },
    ];

    render(<CuisineSection onPickCuisine={vi.fn()} />);

    expect(await screen.findByText("Японская")).toBeTruthy();
  });

  it("ряд идёт в порядке справочника, а не по алфавиту", async () => {
    cuisines.data = [
      { id: "european", name: "Европейская", imageUrl: "https://cdn.example/e.png" },
      { id: "authors", name: "Авторская", imageUrl: "https://cdn.example/a.png" },
    ];

    render(<CuisineSection onPickCuisine={vi.fn()} />);

    // Порядок ряда задаёт платформа своим display_order; по алфавиту
    // «Авторская» стояла бы первой.
    const labels = (await screen.findAllByRole("button")).map((node) => node.textContent);
    expect(labels).toEqual(["Европейская", "Авторская"]);
  });
});
