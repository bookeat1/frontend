import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { OceanStorySection } from "../OceanStorySection";

const t = getDictionary("ru");

/**
 * ГАРМОШКА «История бренда».
 *
 * Правило владельца (2026-09-03): открыта не больше одной главы — открываешь
 * новую, предыдущая закрывается. Проверяется именно ЗАКРЫТИЕ предыдущей, а не
 * только открытие новой: компонент, у которого каждая карточка помнит своё
 * состояние сама, откроет вторую и оставит первую — и тест «вторая
 * открылась» его пропустил бы.
 */

vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const [first, second, third] = t.oceanBasket.chapters;

const carets = (name: "CaretUp" | "CaretDown") =>
  document.querySelectorAll(`[data-testid="icon-${name}"]`).length;

describe("гармошка глав истории", () => {
  it("у всех четырёх глав есть текст — в ru, kk и en", () => {
    for (const locale of ["ru", "kk", "en"] as const) {
      const chapters = getDictionary(locale).oceanBasket.chapters;
      expect(chapters).toHaveLength(4);
      for (const chapter of chapters) {
        expect(chapter.body.trim().length, `${locale}: ${chapter.title}`).toBeGreaterThan(0);
      }
    }
  });

  it("страница открывается с раскрытой первой главой, остальные свёрнуты", () => {
    render(<OceanStorySection />);

    expect(screen.getByText(first.body)).toBeTruthy();
    expect(screen.queryByText(second.body)).toBeNull();
    expect(screen.queryByText(third.body)).toBeNull();
    // Кнопка сворачивания ровно одна — у открытой главы.
    expect(screen.getAllByRole("button", { name: /^Свернуть главу/ })).toHaveLength(1);
  });

  it("открываешь вторую главу — первая ЗАКРЫВАЕТСЯ", () => {
    render(<OceanStorySection />);

    fireEvent.click(screen.getByLabelText(t.oceanBasket.chapterExpand(second.title)));

    expect(screen.getByText(second.body)).toBeTruthy();
    // Само правило: текст первой главы ушёл, и её кнопка снова «Раскрыть».
    expect(screen.queryByText(first.body)).toBeNull();
    expect(screen.getByLabelText(t.oceanBasket.chapterExpand(first.title))).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Свернуть главу/ })).toHaveLength(1);
  });

  it("третья после второй: открыта ровно одна, и это третья", () => {
    render(<OceanStorySection />);

    fireEvent.click(screen.getByLabelText(t.oceanBasket.chapterExpand(second.title)));
    fireEvent.click(screen.getByLabelText(t.oceanBasket.chapterExpand(third.title)));

    expect(screen.getByText(third.body)).toBeTruthy();
    expect(screen.queryByText(second.body)).toBeNull();
    expect(screen.queryByText(first.body)).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Свернуть главу/ })).toHaveLength(1);
  });

  it("тап по открытой главе сворачивает её — открытых не остаётся", () => {
    render(<OceanStorySection />);

    fireEvent.click(screen.getByLabelText(t.oceanBasket.chapterCollapse(first.title)));

    expect(screen.queryByText(first.body)).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^Свернуть главу/ })).toHaveLength(0);
  });

  it("шеврон открытой главы смотрит вверх, у остальных — вниз, и переезжает вместе с ней", () => {
    // Осознанное отступление от макета: там во всех карточках chevron-down.
    render(<OceanStorySection />);

    expect(carets("CaretUp")).toBe(1);
    expect(carets("CaretDown")).toBe(3);

    fireEvent.click(screen.getByLabelText(t.oceanBasket.chapterExpand(second.title)));

    expect(carets("CaretUp")).toBe(1);
    expect(carets("CaretDown")).toBe(3);
    // И вверх смотрит именно у второй: её кнопка содержит CaretUp.
    const secondButton = screen.getByLabelText(t.oceanBasket.chapterCollapse(second.title));
    expect(secondButton.querySelector('[data-testid="icon-CaretUp"]')).not.toBeNull();
  });
});
