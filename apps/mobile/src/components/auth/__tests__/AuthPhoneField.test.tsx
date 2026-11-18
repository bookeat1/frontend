import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetIpCountryGuess } from "@bookeat/phone";
import React, { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPhoneField } from "../AuthPhoneField";

function Harness({ onEmit }: { onEmit?: (e164: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <AuthPhoneField
      value={value}
      accessibilityLabel="Номер телефона"
      onChange={({ e164 }) => {
        setValue(e164);
        onEmit?.(e164);
      }}
    />
  );
}

const countryButton = () => screen.getByRole("button", { name: /Открыть список/ });
const input = () => screen.getByLabelText("Номер телефона") as HTMLInputElement;

describe("поле телефона на экране входа", () => {
  beforeEach(() => resetIpCountryGuess());

  it("без ответа по IP код остаётся +7", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(countryButton().getAttribute("aria-label")).toBe(
        "Код страны: Казахстан, +7. Открыть список",
      ),
    );
  });

  it("код пустого поля берётся по IP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ country: "TR" }) }) as Response),
    );
    render(<Harness />);
    await waitFor(() =>
      expect(countryButton().getAttribute("aria-label")).toBe(
        "Код страны: Турция, +90. Открыть список",
      ),
    );
  });

  it("код страны выбирается из списка, и номер уходит с ним", () => {
    const onEmit = vi.fn();
    render(<Harness onEmit={onEmit} />);

    fireEvent.click(countryButton());
    fireEvent.change(screen.getByLabelText("Страна или код"), { target: { value: "США" } });
    fireEvent.click(screen.getByRole("button", { name: "Код страны: США, +1" }));
    fireEvent.change(input(), { target: { value: "2125551234" } });

    expect(input().value).toBe("(212) 555-1234");
    expect(onEmit).toHaveBeenLastCalledWith("+12125551234");
  });
});
