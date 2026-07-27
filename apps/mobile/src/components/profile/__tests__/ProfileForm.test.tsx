import { RepositoryError, type AuthUser } from "@bookeat/api";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../ProfileForm";

/**
 * REGRESSION GUARD — сессия умирает посреди правки, и правка исчезает.
 *
 * The guest opens «Профиль», types a new name, and the access token expires
 * while they are typing. The app refreshes tokens by itself, so the usual
 * outcome is invisible — but when the REFRESH token is dead too, the auth
 * context signs the guest out, the ["me"] cache entry is purged and the screen
 * would normally swap to «Вы не вошли», taking the typed text with it. The
 * guest signs back in and has to retype everything, having been given no
 * reason to believe their edit was ever at risk.
 *
 * Two things are asserted here and nothing else matters as much:
 *   1. whatever was typed is STILL on screen after any failure;
 *   2. a failed save is never dressed up as «Сохранено».
 *
 * The form is rendered directly rather than through `app/profile.tsx` — that
 * screen is an expo-router route and cannot be mounted in jsdom (TESTING.md).
 * The screen's own part (keeping this component mounted after the sign-out) is
 * a five-line wiring in profile.tsx and is NOT covered here.
 */

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u-1",
    email: "",
    fullName: "Дамир",
    phone: "+77010000000",
    city: null,
    birthDate: null,
    ...overrides,
  };
}

/** react-native-web renders TextField's label as `aria-label`, so the field is
 * addressed the way a screen reader would address it. */
function nameField(): HTMLInputElement {
  return screen.getByLabelText("Имя") as HTMLInputElement;
}

describe("сессия закончилась посреди правки", () => {
  it("правку не выбрасывает и не выдаёт за сохранённую", async () => {
    // 401 is what the repository throws AFTER the HTTP client has already
    // spent its one refresh-and-retry: the session is genuinely gone.
    const onSave = vi.fn(async () => {
      throw new RepositoryError("Not authenticated", undefined, 401);
    });
    const onSessionExpired = vi.fn();

    render(<ProfileForm user={user()} onSave={onSave} onSessionExpired={onSessionExpired} />);

    fireEvent.change(nameField(), { target: { value: "Дамир Саркулин" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));

    // The whole point: the typed value is still there to press «Сохранить» on.
    expect(nameField().value).toBe("Дамир Саркулин");
    expect(screen.queryByText("Сохранено")).toBeNull();
    expect(screen.getByText(/Сессия закончилась/)).toBeTruthy();
    expect(screen.getByText(/Ваши изменения на экране/)).toBeTruthy();
  });

  it("после повторного входа та же правка уходит одним запросом", async () => {
    let dead = true;
    const onSave = vi.fn(async (patch: { fullName?: string }) => {
      if (dead) throw new RepositoryError("Not authenticated", undefined, 401);
      return user({ fullName: patch.fullName ?? "" });
    });

    render(<ProfileForm user={user()} onSave={onSave} />);
    fireEvent.change(nameField(), { target: { value: "Дамир Саркулин" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(screen.getByText(/Сессия закончилась/)).toBeTruthy());

    // The guest signs in again in another screen and comes back to this form.
    dead = false;
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(screen.getByText("Сохранено")).toBeTruthy());
    expect(onSave).toHaveBeenLastCalledWith({ fullName: "Дамир Саркулин" });
    expect(nameField().value).toBe("Дамир Саркулин");
  });

  it("обрыв связи тоже не стирает введённое", async () => {
    const onSave = vi.fn(async () => {
      throw new RepositoryError("Network error requesting /users/me");
    });
    render(<ProfileForm user={user()} onSave={onSave} />);

    fireEvent.change(nameField(), { target: { value: "Новое имя" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(screen.getByText(/Не дозвонились до сервера/)).toBeTruthy());
    expect(nameField().value).toBe("Новое имя");
    expect(screen.queryByText("Сохранено")).toBeNull();
  });
});

describe("форма", () => {
  it("не отправляет запрос, пока дата рождения не по формату", async () => {
    const onSave = vi.fn();
    render(<ProfileForm user={user()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Дата рождения"), { target: { value: "04.05.1990" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(screen.getByText(/ГГГГ-ММ-ДД/)).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByText("Сохранено")).toBeNull();
  });

  it("двойное нажатие не отправляет второй запрос", async () => {
    let release: (value: AuthUser) => void = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<AuthUser>((resolve) => {
          release = resolve;
        }),
    );
    render(<ProfileForm user={user()} onSave={onSave} />);

    fireEvent.change(nameField(), { target: { value: "Дамир С." } });
    const button = screen.getByRole("button", { name: "Сохранить" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onSave).toHaveBeenCalledTimes(1);
    release(user({ fullName: "Дамир С." }));
    await waitFor(() => expect(screen.getByText("Сохранено")).toBeTruthy());
  });

  it("телефон показан, но редактировать его нечем — это не поле ввода", () => {
    render(<ProfileForm user={user()} onSave={vi.fn()} />);

    expect(screen.getByText("+77010000000")).toBeTruthy();
    expect(screen.getByText(/по нему вы входите/)).toBeTruthy();
    // A disabled input would still be an input; there must be none at all.
    expect(screen.queryByLabelText("Телефон")).toBeNull();
  });
});
