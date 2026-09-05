import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import { EventCard, GuideCard } from "@web/components/home/Cards";
import { eventSummary, guideCollection, renderScreen } from "@web/test/harness";

/**
 * Карточки лент главной сверены с секцией «Афиша» (узел 3525:14272): тег в
 * карточке события ровно один, а карточка подборки — ссылка ровно тогда,
 * когда ей дали адрес (его даёт `HomeScreen` за флагом `SHOW_SECTION_LINKS`).
 */

describe("карточка события", () => {
  it("показывает ровно один тег, даже если у события их три", () => {
    renderScreen(<EventCard event={eventSummary()} />);

    const tags = screen.getAllByRole("listitem");
    expect(tags.map((tag) => tag.textContent)).toEqual(["Живая музыка"]);
  });

  it("без тегов список тегов не рисуется", () => {
    renderScreen(<EventCard event={eventSummary({ tags: [] })} />);

    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("карточка подборки", () => {
  it("с адресом — ссылка на подборку по заголовку", () => {
    renderScreen(<GuideCard collection={guideCollection()} href="/guide/winter-terraces" />);

    const link = screen.getByRole("link", { name: "Зимние террасы" });
    expect(link.getAttribute("href")).toBe("/guide/winter-terraces");
  });

  it("без адреса (флаг выключен) ссылки нет, заголовок остаётся", () => {
    renderScreen(<GuideCard collection={guideCollection()} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { name: "Зимние террасы" })).toBeTruthy();
  });
});
