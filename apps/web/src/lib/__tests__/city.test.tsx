import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Дефолтный город: пока гость ничего не выбрал (и геолокация не подключена,
 * см. ADR-016 «Город гостя»), сайт должен открывать «Алматы» — сразу, не
 * дожидаясь `GET /cities`, и вне зависимости от порядка городов в ответе
 * (бэкенд отдаёт `["Астана","Алматы"]`, а не по алфавиту).
 */

let getCitiesMock = vi.fn(async () => ["Алматы"]);

vi.mock("@web/lib/api", () => ({
  get repository() {
    return { getCities: getCitiesMock };
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { CityProvider, useCity } = await import("@web/lib/city");

function CityProbe() {
  const { city } = useCity();
  return <div data-testid="city">{city ?? "(none)"}</div>;
}

function renderWithCity() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CityProvider>
        <CityProbe />
      </CityProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useCity default", () => {
  it("shows Алматы immediately, before GET /cities resolves", () => {
    getCitiesMock = vi.fn(() => new Promise<string[]>(() => {})); // never resolves
    renderWithCity();
    expect(screen.getByTestId("city").textContent).toBe("Алматы");
  });

  it("stays Алматы even when the server lists Астана first", async () => {
    getCitiesMock = vi.fn(async () => ["Астана", "Алматы"]);
    renderWithCity();
    await waitFor(() => expect(getCitiesMock).toHaveBeenCalled());
    expect(screen.getByTestId("city").textContent).toBe("Алматы");
  });

  it("honours a saved city once the server confirms it still exists", async () => {
    window.localStorage.setItem("bookeat.web.city", "Астана");
    getCitiesMock = vi.fn(async () => ["Астана", "Алматы"]);
    renderWithCity();
    await waitFor(() => expect(screen.getByTestId("city").textContent).toBe("Астана"));
  });

  it("falls back to Алматы when the saved city is no longer offered", async () => {
    window.localStorage.setItem("bookeat.web.city", "Караганда");
    getCitiesMock = vi.fn(async () => ["Астана", "Алматы"]);
    renderWithCity();
    await waitFor(() => expect(screen.getByTestId("city").textContent).toBe("Алматы"));
  });
});
