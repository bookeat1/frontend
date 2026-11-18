import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetIpCountryGuess } from "@bookeat/phone";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PhoneField } from "@web/components/ui/PhoneField";

function Harness({ initial = "", onEmit }: { initial?: string; onEmit?: (e164: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PhoneField
      label="Телефон"
      value={value}
      onChange={({ e164 }) => {
        setValue(e164);
        onEmit?.(e164);
      }}
    />
  );
}

const input = () => screen.getByRole("textbox", { name: "Телефон" }) as HTMLInputElement;
const countryButton = () => screen.getByRole("button", { name: /Код страны/ });

function ipSays(country: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ country }) }) as Response),
  );
}

describe("поле телефона с выбором страны", () => {
  beforeEach(() => resetIpCountryGuess());

  it("без ответа по IP остаётся Казахстан", async () => {
    render(<Harness />);
    await waitFor(() => expect(countryButton().textContent).toContain("+7"));
    expect(countryButton().textContent).toContain("KZ");
  });

  it("страна пустого поля берётся по IP", async () => {
    ipSays("TR");
    render(<Harness />);
    await waitFor(() => expect(countryButton().textContent).toContain("+90"));
  });

  it("догадка по IP не трогает поле с номером из профиля", async () => {
    ipSays("TR");
    render(<Harness initial="+77010000000" />);
    await Promise.resolve();
    await Promise.resolve();
    expect(countryButton().textContent).toContain("+7");
    expect(input().value).toBe("701 000-00-00");
  });

  it("список стран — по алфавиту названий, без закреплённых сверху", () => {
    render(<Harness />);
    fireEvent.click(countryButton());
    const names = screen.getAllByRole("option").map((row) => row.firstChild?.textContent ?? "");
    expect(names.length).toBeGreaterThan(200);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "ru")));
  });

  it("выбранная в списке страна меняет код, и номер уходит с ним", () => {
    const onEmit = vi.fn();
    render(<Harness onEmit={onEmit} />);
    fireEvent.click(countryButton());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Герм" } });
    fireEvent.click(screen.getByRole("option", { name: /Германия/ }));

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(countryButton().textContent).toContain("+49");

    fireEvent.change(input(), { target: { value: "15112345678" } });
    expect(onEmit).toHaveBeenLastCalledWith("+4915112345678");
  });

  it("поиск находит страну и по коду", () => {
    render(<Harness />);
    fireEvent.click(countryButton());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "+998" } });
    expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual(["Узбекистан+998"]);
  });
});
