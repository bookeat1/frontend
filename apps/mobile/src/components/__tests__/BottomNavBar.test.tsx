import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { colors } from "@bookeat/design-tokens";
import { activeNavKey, BottomNavBar } from "../BottomNavBar";

/**
 * Нижние вкладки после смены четвёртой (избранное → гастрогид).
 *
 * Проверяем ровно то, что ломается молча: куда ведёт четвёртая вкладка и какая
 * вкладка подсвечена на конкретном адресе. Пиксели тут не проверяются — их
 * проверяет глаз, а вот «/gastroguide/collections/almaty-brunch подсвечивает
 * Гастрогид» человек на глаз не заметит, пока гость не пожалуется.
 *
 * С 2026-08-28 здесь же держится РАЗВОД ДВУХ РАЗДЕЛОВ: `/articles` — это
 * «Статьи», отдельная сущность, и вкладку гастрогида он подсвечивать НЕ
 * должен. Раньше подсвечивал, и это была видимая часть бага «раздел „Статьи“
 * ведёт в гастрогид».
 */

const replace = vi.fn();
let pathname = "/";

vi.mock("expo-router", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

beforeEach(() => {
  pathname = "/";
  replace.mockClear();
});

/** <svg> глифа внутри вкладки. Иконки рисуются по-настоящему, без заглушки. */
function iconOf(label: string): SVGElement {
  const svg = screen.getByRole("tab", { name: label }).querySelector("svg");
  if (!svg) throw new Error(`У вкладки «${label}» нет глифа`);
  return svg;
}

/**
 * Цвета ВСЕХ линий глифа.
 *
 * Именно всех, а не первой: в выгрузке из Figma цвет был зашит в каждую
 * линию отдельно, и забытая линия осталась бы серой на активной вкладке.
 * У «Мои брони» обложка приехала заливкой, а не обводкой, поэтому читаем и
 * `fill`.
 */
function iconColorsOf(label: string): string[] {
  return [...iconOf(label).querySelectorAll("circle, ellipse, path")].map(
    (shape) => shape.getAttribute("stroke") ?? shape.getAttribute("fill") ?? "",
  );
}

function uniqueColorOf(label: string): string {
  const colorsUsed = new Set(iconColorsOf(label));
  expect(colorsUsed.size).toBe(1);
  return [...colorsUsed][0];
}

describe("activeNavKey", () => {
  it("подсвечивает «Гастрогид» на корне вкладки, рубрике и подборке", () => {
    expect(activeNavKey("/gastroguide")).toBe("gastroguide");
    expect(activeNavKey("/gastroguide/rubric/kazakh-cuisine")).toBe("gastroguide");
    expect(activeNavKey("/gastroguide/collections/almaty-brunch")).toBe("gastroguide");
  });

  it("не подсвечивает гастрогид на «Статьях»: это другой раздел", () => {
    expect(activeNavKey("/articles")).toBeNull();
    expect(activeNavKey("/articles/almaty-longread")).toBeNull();
  });

  it("не подсвечивает ничего на избранном: вкладки у него больше нет", () => {
    expect(activeNavKey("/favorites")).toBeNull();
  });

  it("оставляет прежние вкладки на своих адресах", () => {
    expect(activeNavKey("/")).toBe("overview");
    expect(activeNavKey("/search")).toBe("search");
    expect(activeNavKey("/bookings")).toBe("bookings");
    expect(activeNavKey("/booking/42")).toBe("bookings");
    expect(activeNavKey("/profile")).toBe("profile");
  });
});

describe("BottomNavBar", () => {
  it("показывает пять вкладок, первая называется «Главная», четвёртая — «Гастрогид»", () => {
    render(<BottomNavBar />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Главная",
      "Поиск",
      "Мои брони",
      "Гастрогид",
      "Профиль",
    ]);
  });

  it("рисует глифы из макета (Solar Linear), а не подобия из Phosphor", () => {
    render(<BottomNavBar />);

    // Каждый глиф узнаётся по своей геометрии из выгрузки Figma: круг радиуса
    // 8 у компаса, 7.6 у лупы, залитая обложка у блокнота, точка радиуса 1.6
    // на карте, эллипс-плечи у пользователя. Подобия из Phosphor, которые тут
    // стояли раньше, ни одной из этих примет не имеют.
    expect(iconOf("Главная").querySelector('circle[r="8"]')).not.toBeNull();
    expect(iconOf("Поиск").querySelector('circle[r="7.6"]')).not.toBeNull();
    expect(iconOf("Мои брони").querySelector("path[fill]")).not.toBeNull();
    expect(iconOf("Гастрогид").querySelector('circle[r="1.6"]')).not.toBeNull();
    expect(iconOf("Профиль").querySelector("ellipse")).not.toBeNull();
  });

  it("красит КАЖДУЮ линию глифа, а не первую: у блокнота их шесть", () => {
    pathname = "/bookings";
    render(<BottomNavBar />);

    const strokes = iconColorsOf("Мои брони");
    expect(strokes.length).toBe(6);
    expect(strokes.every((color) => color === colors.brand.primary)).toBe(true);
  });

  it("четвёртая вкладка ведёт на /gastroguide и заменяет маршрут, а не кладёт его в стек", () => {
    render(<BottomNavBar />);

    screen.getByRole("tab", { name: "Гастрогид" }).click();

    expect(replace).toHaveBeenCalledWith("/gastroguide");
    // Вкладка не может привести гостя в «Статьи» — это соседний раздел.
    expect(replace).not.toHaveBeenCalledWith("/articles");
  });

  it("на подборке гастрогида отмечена именно четвёртая вкладка", () => {
    pathname = "/gastroguide/collections/almaty-brunch";
    render(<BottomNavBar />);

    // Активность видно по цвету глифа: `accessibilityState` — нативное
    // свойство, react-native-web (на нём крутится этот прогон) его в
    // aria-selected не переносит, а красный/серый — то же самое, что видит
    // гость.
    expect(uniqueColorOf("Гастрогид")).toBe(colors.brand.primary);
    expect(uniqueColorOf("Главная")).toBe(colors.text.navInactive);
  });

  it("повторное нажатие на активную вкладку никуда не ведёт", () => {
    render(<BottomNavBar />);

    screen.getByRole("tab", { name: "Главная" }).click();

    expect(replace).not.toHaveBeenCalled();
  });
});
