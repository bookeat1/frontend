import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/locale", async () => {
  const { getDictionary } = await import("@bookeat/i18n");
  return { useLocale: () => ({ locale: "ru", dictionary: getDictionary(), setLocale: vi.fn() }) };
});

const { LocationOptInCard } = await import("../LocationOptInCard");

/** Показ засчитывается по факту появления карточки на экране (кр. 13). */
describe("LocationOptInCard", () => {
  it("onShown зовётся один раз при появлении, не при перерисовке", () => {
    const onShown = vi.fn();
    const props = { working: false, onAllow: vi.fn(), onLater: vi.fn(), onShown };
    const { rerender } = render(<LocationOptInCard {...props} />);
    expect(onShown).toHaveBeenCalledTimes(1);
    rerender(<LocationOptInCard {...props} working />);
    expect(onShown).toHaveBeenCalledTimes(1);
  });
});
