import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import type { HomePromo } from "@bookeat/api/client";

import { EventCard, GuideCard, PromoCard, guideCardHref } from "@web/components/home/Cards";
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

  /** Критерий 10 T1: событие платформы (ADR-024) не несёт `restaurant` —
   * карточка рендерится целиком, строка места состоит только из времени, а
   * заголовок ведёт на `/events/:id` (у платформы нет `/venues/:id`). */
  it("без restaurant (событие платформы) рендерится, строка места — только время", () => {
    renderScreen(
      <EventCard
        event={eventSummary({ restaurantId: null, restaurant: null, startsAt: "2026-05-18T13:00:00Z" })}
      />,
    );

    expect(screen.getByRole("heading", { name: "BBQ-бранч на террасе" })).toBeTruthy();
    const link = screen.getByRole("link", { name: "BBQ-бранч на террасе" });
    expect(link.getAttribute("href")).toBe("/events/evt-1");
  });
});

/** Критерий 13 T1b (решение владельца 2026-09-06): карточка акции главной
 * ведёт на свою страницу `/promos/:id`, а не на страницу заведения. */
describe("карточка акции", () => {
  it("ведёт на /promos/:id", () => {
    const promo: HomePromo = {
      id: "promo-1",
      restaurantId: "r-1",
      restaurantName: "INZHU",
      title: "−30% на завтраки",
      description: "",
      startsAt: "2026-05-01T00:00:00Z",
      endsAt: "2026-05-31T00:00:00Z",
      coverImageUrl: null,
      images: [],
      discountPercent: 30,
    };
    renderScreen(<PromoCard promo={promo} />);
    const link = screen.getByRole("link", { name: "−30% на завтраки" });
    expect(link.getAttribute("href")).toBe("/promos/promo-1");
  });

  /**
   * Замечание code-review 2026-09-12: обёртка заголовка должна поднимать
   * текст над затемнением (`bg-promo-scrim`) через `z-10` БЕЗ `relative` —
   * `relative` на этом div снова превращает его в предка растянутой ссылки
   * (`after:absolute after:inset-0` у `Link` внутри), и кликабельной остаётся
   * только полоска заголовка, а не вся карточка. Без `z-10` затемнение рисуется
   * поверх текста и на светлых фото гасит его почти до невидимости — оба
   * симптома незаметны в обычных юнитах (клик по фото никто не проверял),
   * этот тест — сторож именно на className, а не на поведение.
   */
  it("обёртка заголовка: z-10 есть, relative нет", () => {
    const promo: HomePromo = {
      id: "promo-1",
      restaurantId: "r-1",
      restaurantName: "INZHU",
      title: "−30% на завтраки",
      description: "",
      startsAt: "2026-05-01T00:00:00Z",
      endsAt: "2026-05-31T00:00:00Z",
      coverImageUrl: null,
      images: [],
      discountPercent: 30,
    };
    renderScreen(<PromoCard promo={promo} />);
    const heading = screen.getByRole("heading", { name: "−30% на завтраки" });
    const wrapper = heading.parentElement;
    expect(wrapper).not.toBeNull();
    const classes = wrapper!.className.split(/\s+/);
    expect(classes).toContain("z-10");
    expect(classes).not.toContain("relative");
  });
});

describe("карточка подборки", () => {
  it("с адресом — ссылка на подборку по заголовку", () => {
    renderScreen(<GuideCard collection={guideCollection()} href="/guide/winter-terraces" />);

    const link = screen.getByRole("link", { name: "Зимние террасы" });
    expect(link.getAttribute("href")).toBe("/guide/winter-terraces");
  });

  it("без адреса (нет categorySlugs) ссылки нет, заголовок остаётся", () => {
    renderScreen(<GuideCard collection={guideCollection()} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { name: "Зимние террасы" })).toBeTruthy();
  });
});

/**
 * `guideCardHref` (2026-09-09, решение владельца): карточка гастрогида
 * ведёт на `/guide/rubric/[slug]` (тот же роут, что уже используют рубрики
 * на `/guide`, см. `GuideScreen.tsx`), когда у подборки есть `categorySlugs`
 * — независимо от `SHOW_SECTION_LINKS` (тот больше не влияет на карточку,
 * только на ссылки «Вся афиша»/«Все подборки» в шапках секций). Ocean Basket
 * — по-прежнему исключение с зашитым `/brand/ocean-basket`.
 */
describe("guideCardHref", () => {
  it("с categorySlugs — ссылка на /guide/rubric/[первый слаг]", () => {
    const collection = guideCollection({
      slug: "kazakh-cuisine",
      categorySlugs: ["kazakh-cuisine-rubric", "other-rubric"],
    });
    expect(guideCardHref(collection)).toBe("/guide/rubric/kazakh-cuisine-rubric");
  });

  it("без categorySlugs (и не Ocean Basket) — адреса нет", () => {
    const collection = guideCollection({ slug: "week-picks", categorySlugs: [] });
    expect(guideCardHref(collection)).toBeUndefined();
  });

  it("Ocean Basket — всегда на /brand/ocean-basket, даже без categorySlugs", () => {
    const collection = guideCollection({ slug: "ocean-basket", categorySlugs: [] });
    expect(guideCardHref(collection)).toBe("/brand/ocean-basket");
  });
});

/**
 * Контракт адаптива (`docs/responsive.md`, § 5, дыра № 6): высоты обложек из
 * макета (260, 196, 300) живут ТОЛЬКО под `lg:`, ниже — размер мобильной
 * карточки. Замок против возврата голого `h-[300px]`: он не ломает 360, и
 * глазами его пропустить проще всего.
 */
describe("обложки карточек ниже lg", () => {
  it("событие: обложка с мобильной высотой, число макета — под lg", () => {
    const { container } = renderScreen(<EventCard event={eventSummary()} />);

    const cover = container.querySelector(".h-event-image-mobile");
    expect(cover?.className).toContain("lg:h-event-image");
    expect(container.querySelector(".h-event-image")).toBeNull();
    expect(container.querySelector(".min-h-event-card")).toBeNull();
  });

  it("подборка: обложка держит мобильную пропорцию, высота макета — под lg", () => {
    const { container } = renderScreen(<GuideCard collection={guideCollection()} />);

    const cover = container.querySelector(".aspect-home-cover");
    expect(cover?.className).toContain("lg:h-guide-image");
    expect(container.querySelector(".h-\\[300px\\]")).toBeNull();
  });
});
