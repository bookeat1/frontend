import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FoodieProfile, FoodieProfileOptions } from "@bookeat/api/client";

import {
  authRepositoryStub,
  foodieOption,
  foodieProfile,
  foodieProfileOptions,
  repositoryStub,
} from "@web/test/harness";
import { CityProvider } from "@web/lib/city";
import { LocaleProvider } from "@web/lib/locale";

/**
 * Раздел «Фуди-профиль» (`ProfileFoodie.tsx`) — спека
 * `foodie-profile-web-desktop-20260930.md`. Покрывает критерии 5-10, 14, 16,
 * 18-23: состояния загрузки/ошибки, гидрацию с отбросом скрытых кодов,
 * устойчивость черновика к фоновому refetch, лимит кухонь, эксклюзивность
 * «Без диеты», одиночный бюджет, PUT-замену целиком, pristine-сохранение без
 * запроса, инвалидацию персонализированных рядов и восстановление после
 * ошибки сохранения.
 */

const repository = repositoryStub();
const authRepository = authRepositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  get authRepository() {
    return authRepository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

vi.mock("@web/lib/auth", () => ({
  useAuth: () => ({ signedIn: true, isLoading: false }),
}));

const { ProfileFoodie } = await import("@web/components/profile/ProfileFoodie");

function renderFoodie(ui: ReactElement = <ProfileFoodie />) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <CityProvider>{ui}</CityProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

beforeEach(() => {
  repository.getFoodieProfileOptions = vi.fn(async () => foodieProfileOptions());
  authRepository.getFoodieProfile = vi.fn(async () => foodieProfile());
  authRepository.replaceFoodieProfile = vi.fn(async (input: FoodieProfile) => input);
});

describe("ProfileFoodie — загрузка", () => {
  it("критерий 5: пока не ответил хотя бы один из двух запросов — скелет, кнопки нет", () => {
    repository.getFoodieProfileOptions = vi.fn(() => pending<FoodieProfileOptions>());
    renderFoodie();

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Сохранить изменения" })).toBeNull();
  });

  it("критерий 6: ошибка любого GET — блок с «Повторить», после успеха форма появляется", async () => {
    authRepository.getFoodieProfile = vi.fn(async () => {
      throw new Error("network");
    });
    renderFoodie();

    const retry = await screen.findByRole("button", { name: "Повторить" });
    expect(screen.queryByRole("button", { name: "Сохранить изменения" })).toBeNull();

    authRepository.getFoodieProfile = vi.fn(async () => foodieProfile());
    fireEvent.click(retry);

    expect(await screen.findByRole("button", { name: "Сохранить изменения" })).toBeTruthy();
  });

  it("критерий 8: пустой профиль — «Выбрано 0 из 5», без пустых состояний", async () => {
    renderFoodie();
    expect(await screen.findByText("Выбрано 0 из 5")).toBeTruthy();
    expect(screen.queryByText(/пусто/i)).toBeNull();
  });

  it("критерий 7: скрытый (неактивный) код отбрасывается при гидрации", async () => {
    authRepository.getFoodieProfile = vi.fn(async () => foodieProfile({ cuisines: ["kazakh", "meat"] }));
    renderFoodie();

    expect(await screen.findByText("Выбрано 1 из 5")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Мясо" })).toBeNull();
    const kazakh = screen.getByRole("button", { name: "Казахская" });
    expect(kazakh.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("ProfileFoodie — черновик переживает фоновый refetch", () => {
  it("критерий 9: изменил выбор → повторный ответ GET с другими данными не стирает выбор", async () => {
    const { client } = renderFoodie();
    await screen.findByText("Выбрано 0 из 5");

    fireEvent.click(screen.getByRole("button", { name: "Итальянская" }));
    expect(await screen.findByText("Выбрано 1 из 5")).toBeTruthy();

    // Фоновый refetch (например, возврат фокуса вкладки) приносит ДРУГИЕ
    // данные — черновик не должен их подхватить молча.
    client.setQueryData(["foodie-profile"], foodieProfile({ cuisines: ["kazakh"] }));

    await waitFor(() => expect(screen.getByText("Выбрано 1 из 5")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Итальянская" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Казахская" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("ProfileFoodie — смена локали", () => {
  it("критерий 10: новые названия из справочника перерисовываются, выбранные коды остаются", async () => {
    const { client } = renderFoodie();
    await screen.findByText("Выбрано 0 из 5");

    fireEvent.click(screen.getByRole("button", { name: "Итальянская" }));
    expect(await screen.findByText("Выбрано 1 из 5")).toBeTruthy();

    // Смена языка перезапрашивает `[locale, "foodie-options"]` с новыми
    // названиями (сервер переводит по `Accept-Language`) — коды в справочнике
    // те же, черновик хранит только коды.
    client.setQueryData(
      ["ru", "foodie-options"],
      foodieProfileOptions({
        cuisines: [
          foodieOption({ id: "c-kazakh", code: "kazakh", name: "Kazakh (EN)", displayOrder: 0 }),
          foodieOption({ id: "c-italian", code: "italian", name: "Italian (EN)", displayOrder: 1 }),
          foodieOption({ id: "c-japanese", code: "japanese", name: "Japanese (EN)", displayOrder: 2 }),
        ],
      }),
    );

    expect(await screen.findByText("Выбрано 1 из 5")).toBeTruthy();
    const renamed = await screen.findByRole("button", { name: "Italian (EN)" });
    expect(renamed.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("ProfileFoodie — кухни", () => {
  it("критерий 14: лимит блокирует 6-й выбор и показывает подсказку", async () => {
    repository.getFoodieProfileOptions = vi.fn(async () =>
      foodieProfileOptions({
        cuisines: ["a", "b", "c", "d", "e", "f"].map((code, i) =>
          foodieOption({ id: code, code, name: code.toUpperCase(), displayOrder: i }),
        ),
      }),
    );
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");

    for (const name of ["A", "B", "C", "D", "E"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    expect(await screen.findByText("Выбрано 5 из 5")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "F" }));

    expect(screen.getByText("Выбрано 5 из 5")).toBeTruthy();
    const hint = screen.getByText("Сначала уберите одну из выбранных кухонь");
    expect(hint.getAttribute("role")).toBe("status");
    expect(screen.getByRole("button", { name: "F" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("ProfileFoodie — диеты", () => {
  it("критерий 16: «Без диеты» эксклюзивна, выбор другой диеты её снимает", async () => {
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");

    fireEvent.click(screen.getByRole("button", { name: "Без диеты" }));
    expect(screen.getByRole("button", { name: "Без диеты" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Веганская" }));
    expect(screen.getByRole("button", { name: "Без диеты" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Веганская" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("ProfileFoodie — бюджет", () => {
  it("критерий 18: одиночный выбор, повторный клик снимает", async () => {
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");

    const mid = screen.getByRole("button", { name: /Средний/ });
    fireEvent.click(mid);
    expect(mid.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(mid);
    expect(mid.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("ProfileFoodie — сохранение", () => {
  it("критерий 19: PUT уходит с полным телом (все четыре ключа, включая пустые)", async () => {
    authRepository.getFoodieProfile = vi.fn(async () => foodieProfile({ cuisines: ["kazakh"] }));
    renderFoodie();
    await screen.findByText("Выбрано 1 из 5");

    fireEvent.click(screen.getByRole("button", { name: "Итальянская" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));

    await waitFor(() => expect(authRepository.replaceFoodieProfile).toHaveBeenCalledTimes(1));
    expect(authRepository.replaceFoodieProfile).toHaveBeenCalledWith({
      cuisines: ["kazakh", "italian"],
      diets: [],
      allergies: [],
      budget: null,
    });
    expect(await screen.findByText("Сохранено")).toBeTruthy();
  });

  it("критерий 20: ничего не менял — клик «Сохранить» не шлёт запрос, показывает «Сохранено»", async () => {
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");

    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));

    expect(await screen.findByText("Сохранено")).toBeTruthy();
    expect(authRepository.replaceFoodieProfile).not.toHaveBeenCalled();
  });

  it("критерий 21: во время PUT кнопка занята, второй клик не шлёт запрос ещё раз", async () => {
    let resolveSave: (value: FoodieProfile) => void = () => {};
    authRepository.replaceFoodieProfile = vi.fn(
      () => new Promise<FoodieProfile>((resolve) => (resolveSave = resolve)),
    );
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");
    fireEvent.click(screen.getByRole("button", { name: "Итальянская" }));

    const save = screen.getByRole("button", { name: "Сохранить изменения" });
    fireEvent.click(save);
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(true));
    fireEvent.click(save);
    expect(authRepository.replaceFoodieProfile).toHaveBeenCalledTimes(1);

    resolveSave(foodieProfile({ cuisines: ["italian"] }));
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
  });

  it("критерий 22: при успехе инвалидируются picks/events/promotions", async () => {
    const { client } = renderFoodie();
    const spy = vi.spyOn(client, "invalidateQueries");
    await screen.findByText("Выбрано 0 из 5");

    client.setQueryData(["ru", "picks", "Алматы"], { mode: "for_you", items: [] });
    fireEvent.click(screen.getByRole("button", { name: "Итальянская" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));

    await waitFor(() => expect(authRepository.replaceFoodieProfile).toHaveBeenCalled());
    await waitFor(() =>
      expect(spy.mock.calls.some((call) => typeof (call[0] as { predicate?: unknown })?.predicate === "function")).toBe(
        true,
      ),
    );
  });

  it("критерий 23: ошибка PUT — черновик остаётся, alert показан, повтор шлёт запрос снова", async () => {
    authRepository.replaceFoodieProfile = vi.fn(async () => {
      throw new Error("network");
    });
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");
    fireEvent.click(screen.getByRole("button", { name: "Итальянская" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Итальянская" }).getAttribute("aria-pressed")).toBe("true");
    const save = screen.getByRole("button", { name: "Сохранить изменения" });
    expect(save.hasAttribute("disabled")).toBe(false);

    authRepository.replaceFoodieProfile = vi.fn(async (input: FoodieProfile) => input);
    fireEvent.click(save);
    await waitFor(() => expect(authRepository.replaceFoodieProfile).toHaveBeenCalledTimes(1));
  });
});
