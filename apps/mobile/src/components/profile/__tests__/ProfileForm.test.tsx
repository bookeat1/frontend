import { RepositoryError, type AuthUser } from "@bookeat/api";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    avatarUrl: null,
    createdAt: null,
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

/**
 * REGRESSION GUARD — дату рождения набирали руками, и приложение говорило с
 * гостем на формате своего API.
 *
 * Поле было свободным текстом с подсказкой «ГГГГ-ММ-ДД». Гость, который писал
 * дату так, как её пишут в Казахстане («04.05.1990»), получал красную строку
 * после того, как всё набрал, и должен был догадаться переставить числа и
 * сменить разделитель. Календарь физически не умеет отдать ни неверный
 * формат, ни несуществующий день, ни будущее.
 *
 * Разделение форматов — то, ради чего этот describe написан: на экране
 * ДД.ММ.ГГГГ, в теле PATCH — «YYYY-MM-DD», потому что сервер разбирает
 * `birth_date` через time.Parse("2006-01-02") и ничего другого не принимает.
 * Тест, который проверил бы только экран, пропустил бы поломку контракта.
 */
describe("дата рождения — календарь, а не поле ввода", () => {
  /**
   * Календарь открывается на СЕГОДНЯШНЕМ месяце, поэтому «два раза назад» — это
   * май только в июле. Без фиксированного «сейчас» этот тест сломался бы сам
   * собой в августе, и чинил бы его тот, кто ни при чём.
   *
   * `shouldAdvanceTime` обязателен: `waitFor` ниже опрашивает DOM по таймеру,
   * и с полностью замороженными таймерами он ждал бы вечно.
   */
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-27T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("набрать дату руками негде: поля ввода нет", () => {
    render(<ProfileForm user={user()} onSave={vi.fn()} />);

    const control = screen.getByLabelText(/^Дата рождения/);
    // Свободное поле было <input>. Теперь это кнопка, открывающая календарь.
    expect(control.tagName).not.toBe("INPUT");
    expect(control.getAttribute("role")).toBe("button");
  });

  it("сохранённая дата читается как ДД.ММ.ГГГГ, а не как её формат на проводе", () => {
    render(<ProfileForm user={user({ birthDate: "1990-05-04" })} onSave={vi.fn()} />);

    expect(screen.getByText("04.05.1990")).toBeTruthy();
    expect(screen.queryByText("1990-05-04")).toBeNull();
  });

  it("выбранная в календаре дата уходит на сервер в формате «YYYY-MM-DD»", async () => {
    const onSave = vi.fn(async () => user({ birthDate: "1990-05-04" }));
    render(<ProfileForm user={user()} onSave={onSave} />);

    // Открываем календарь. Даты нет, поэтому он открывается на списке лет —
    // иначе до 1990-го пришлось бы пролистать больше четырёхсот месяцев.
    fireEvent.click(screen.getByLabelText(/^Дата рождения/));
    fireEvent.click(screen.getByRole("button", { name: "1990" }));
    // Список лет сменился сеткой дней того же месяца, что был открыт (июль).
    fireEvent.click(screen.getByRole("button", { name: "Предыдущий месяц" }));
    fireEvent.click(screen.getByRole("button", { name: "Предыдущий месяц" }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    // На экране — по-человечески.
    expect(screen.getByText("04.05.1990")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(screen.getByText("Сохранено")).toBeTruthy());
    // На проводе — как требует time.Parse на сервере.
    expect(onSave).toHaveBeenCalledWith({ birthDate: "1990-05-04" });
  });

  it("«Отмена» не трогает уже сохранённую дату", () => {
    render(<ProfileForm user={user({ birthDate: "1990-05-04" })} onSave={vi.fn()} />);

    fireEvent.click(screen.getByLabelText(/^Дата рождения/));
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.getByText("04.05.1990")).toBeTruthy();
  });
});

describe("форма", () => {
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

  it("телефон показан маской, без поля ввода, без старой подсказки «изменить нельзя»", () => {
    // Router-free (no onEditPhone): the number is a plain read-out.
    render(<ProfileForm user={user()} onSave={vi.fn()} />);

    // Той же маской, что и на входе по номеру: «+77010000000» — формат API, а
    // не то, что гость набирал и узнаёт.
    expect(screen.getByText("+7 (701) 000-00-00")).toBeTruthy();
    expect(screen.queryByText("+77010000000")).toBeNull();
    // The old "номер изменить нельзя…" hint is GONE — the number IS changeable
    // now (see /profile/change-phone), so a screen still saying otherwise would
    // contradict /profile/personal-data.
    expect(screen.queryByText(/по нему вы входите/)).toBeNull();
    // A disabled input would still be an input; there must be none at all.
    expect(screen.queryByLabelText("Телефон")).toBeNull();
  });

  it("с onEditPhone ряд телефона — кнопка в change-phone, а не поле", () => {
    const onEditPhone = vi.fn();
    render(<ProfileForm user={user()} onSave={vi.fn()} onEditPhone={onEditPhone} />);

    // Still shown masked, still not an input.
    expect(screen.getByText("+7 (701) 000-00-00")).toBeTruthy();
    expect(screen.queryByLabelText("Телефон")).toBeNull();
    // The row is a real button with the same a11y label personal-data uses, and
    // it routes into the change-phone flow instead of editing in place.
    const row = screen.getByRole("button", { name: "Изменить номер телефона" });
    fireEvent.click(row);
    expect(onEditPhone).toHaveBeenCalledTimes(1);
  });
});
