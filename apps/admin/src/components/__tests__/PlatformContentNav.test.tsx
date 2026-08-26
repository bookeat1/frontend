import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Раздел «Контент платформы» в навигации.
 *
 * Дверь, за которой управляющий заведения получит только 403, показывать нельзя.
 * Гейт на сервере (`domain.PlatformContentRoles`, сегодня — суперадмин) никуда
 * не девается; это про то, чтобы в меню не было пункта, который не работает.
 */

const auth = { role: "admin" as string };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1", role: auth.role, email: "a@b.kz" }, logout: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("../PushToggle", () => ({ PushToggle: () => null }));
vi.mock("../RestaurantSwitcher", () => ({ RestaurantSwitcher: () => null }));

const { AppShell } = await import("../AppShell");

beforeEach(() => {
  auth.role = "admin";
});
afterEach(cleanup);

describe("навигация: контент платформы", () => {
  it("суперадмин видит оба пункта", () => {
    render(
      <AppShell>
        <div />
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Акции платформы" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Афиша платформы" })).toBeTruthy();
  });

  it("управляющий заведения не видит их вовсе", () => {
    auth.role = "restaurant";
    render(
      <AppShell>
        <div />
      </AppShell>,
    );
    expect(screen.queryByRole("link", { name: "Акции платформы" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Афиша платформы" })).toBeNull();
    // Свои акции и события у него на месте — скрыт именно платформенный уровень.
    expect(screen.getByRole("link", { name: "Акции" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "События" })).toBeTruthy();
  });
});

describe("маршруты платформы работают без выбранного заведения", () => {
  it("оба экрана попали в PLATFORM_ROUTES", async () => {
    const { isPlatformRoute } = await import("@/lib/nav");
    // Иначе гейт панели отправил бы суперадмина выбирать заведение, которого
    // у платформенного контента нет по определению.
    expect(isPlatformRoute("/platform-promos")).toBe(true);
    expect(isPlatformRoute("/platform-events")).toBe(true);
  });
});
