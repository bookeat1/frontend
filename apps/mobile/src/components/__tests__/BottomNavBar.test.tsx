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
 * проверяет глаз, а вот «/articles/almaty-brunch подсвечивает Гастрогид»
 * человек на глаз не заметит, пока гость не пожалуется.
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

/** Цвет глифа внутри вкладки — так подложка-заглушка иконок отдаёт свой цвет. */
function iconColorOf(label: string): string | null | undefined {
  return screen.getByRole("tab", { name: label }).querySelector("span")?.getAttribute("data-color");
}

describe("activeNavKey", () => {
  it("подсвечивает «Гастрогид» на списке подборок и на самой подборке", () => {
    expect(activeNavKey("/articles")).toBe("gastroguide");
    expect(activeNavKey("/articles/almaty-brunch")).toBe("gastroguide");
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

  it("четвёртая вкладка ведёт на /articles и заменяет маршрут, а не кладёт его в стек", () => {
    render(<BottomNavBar />);

    screen.getByRole("tab", { name: "Гастрогид" }).click();

    expect(replace).toHaveBeenCalledWith("/articles");
  });

  it("на подборке гастрогида отмечена именно четвёртая вкладка", () => {
    pathname = "/articles/almaty-brunch";
    render(<BottomNavBar />);

    // Активность видно по цвету глифа: `accessibilityState` — нативное
    // свойство, react-native-web (на нём крутится этот прогон) его в
    // aria-selected не переносит, а красный/серый — то же самое, что видит
    // гость.
    expect(iconColorOf("Гастрогид")).toBe(colors.brand.primary);
    expect(iconColorOf("Главная")).toBe(colors.text.muted);
  });

  it("повторное нажатие на активную вкладку никуда не ведёт", () => {
    render(<BottomNavBar />);

    screen.getByRole("tab", { name: "Главная" }).click();

    expect(replace).not.toHaveBeenCalled();
  });
});
