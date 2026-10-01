import React from "react";
import { vi } from "vitest";
import { type GuestLocation, GuestLocationContext } from "../guest-location";

/** Подставной статус геопозиции для тестов хуков и компонентов. */
export function makeLocation(overrides: Partial<GuestLocation> = {}): GuestLocation {
  return {
    permission: "undetermined",
    canAskAgain: true,
    servicesOff: false,
    precise: null,
    peekFresh: vi.fn(() => null),
    locate: vi.fn(async () => null),
    request: vi.fn(async () => ({ result: "denied" as const, precise: null, point: null })),
    refresh: vi.fn(async () => {}),
    ...overrides,
  };
}

/** Обёртка с мутируемым значением: `ref.current = …` и `rerender()` меняют статус. */
export function locationWrapper(ref: { current: GuestLocation }) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <GuestLocationContext.Provider value={ref.current}>{children}</GuestLocationContext.Provider>;
  };
}
