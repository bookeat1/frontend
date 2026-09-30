import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { LocaleProvider, useLocale, type WebLocale } from "@web/lib/locale";

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

/** Кнопка, которая дёргает РЕАЛЬНЫЙ `setLocale` из `lib/locale` — критерий
 * 10 проверяет настоящую смену языка (ключ `useFoodieOptions` меняется), а
 * не подмену `queryData` под тем же ключом. */
function LocaleSwitchButton({ to }: { to: WebLocale }) {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale(to)}>
      switch-locale-{to}
    </button>
  );
}

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
  // `setLocale` пишет в `window.localStorage` по-настоящему (`STORAGE_KEY` в
  // `lib/locale.tsx`) — `LocaleProvider` следующего теста иначе стартовал бы
  // не с "ru", а с "kk", оставшегося от этого теста.
  afterEach(() => {
    window.localStorage.clear();
  });

  it("критерий 10: реальное переключение языка (setLocale) не роняет несохранённый выбор", async () => {
    // Справочник переводится сервером по `Accept-Language` — коды одни и те
    // же, названия разные. Первый вызов (локаль "ru", дефолт `LocaleProvider`)
    // отдаёт русские названия из `foodieProfileOptions()`, второй (после
    // переключения на "kk") — казахские; ключ запроса `[locale, "foodie-
    // options"]` при этом реально меняется, как в проде.
    let calls = 0;
    repository.getFoodieProfileOptions = vi.fn(async () => {
      calls += 1;
      return calls === 1
        ? foodieProfileOptions()
        : foodieProfileOptions({
            cuisines: [
              foodieOption({ id: "c-kazakh", code: "kazakh", name: "Қазақ асханасы", displayOrder: 0 }),
              foodieOption({ id: "c-italian", code: "italian", name: "Итальян асханасы", displayOrder: 1 }),
              foodieOption({ id: "c-japanese", code: "japanese", name: "Жапон асханасы", displayOrder: 2 }),
            ],
          });
    });

    renderFoodie(
      <>
        <LocaleSwitchButton to="kk" />
        <ProfileFoodie />
      </>,
    );
    await screen.findByText("Выбрано 0 из 5");

    fireEvent.click(screen.getByRole("button", { name: "Итальянская" }));
    expect(await screen.findByText("Выбрано 1 из 5")).toBeTruthy();

    // Настоящее переключение локали — тот же `setLocale`, что подвал сайта и
    // «Настройки» → «Язык и город» дёргают в проде, а не подмена кэша под
    // старым ключом.
    fireEvent.click(screen.getByRole("button", { name: "switch-locale-kk" }));

    // Заголовок раздела перерисовался по-казахски — подтверждение, что
    // локаль реально сменилась, а не осталась "ru".
    expect(await screen.findByText("Сүйікті асхана")).toBeTruthy();

    // Выбор (код "italian") пережил смену справочника и языка формы —
    // именно это стирала смена локали до фикса (`AsyncBlock` размонтировал
    // форму на время `isPending`, черновик в `useState` пропадал).
    const renamed = await screen.findByRole("button", { name: "Итальян асханасы" });
    expect(renamed.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("5-тен 1 таңдалды")).toBeTruthy();
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

  it("ревью-фикс: рамка выбора — отдельный слой поверх фото, не box-shadow на самой кнопке", async () => {
    // `ring`/box-shadow на кнопке-контейнере рисуется ДО абсолютно
    // спозиционированных потомков (фото, градиент) и оказывается под ними —
    // видна только по краям либо не видна вовсе (QA нашёл это по скриншоту
    // `qa-pr285-foodie-1440x900.png`). Рамка теперь — отдельный `<span>`
    // поверх фото/градиента, а не класс на самом `<button>`.
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");
    const tile = screen.getByRole("button", { name: "Итальянская" });
    fireEvent.click(tile);

    expect(tile.className).not.toMatch(/ring-2/);
    const overlay = tile.querySelector(".ring-brand");
    expect(overlay).toBeTruthy();
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
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

  it("ревью-фикс: синхронный двойной клик (без ожидания перерисовки) шлёт один PUT", async () => {
    // `saveMutation.isPending` — стейт React Query, React выставляет его
    // АСИНХРОННО; настоящий dblclick браузера шлёт оба `click` в одном
    // событийном цикле, до того как кнопка успевает перерисоваться в
    // `disabled`. В отличие от критерия 21 выше (там `waitFor` перед вторым
    // кликом специально ждёт перерисовки — эту гонку он не ловит), здесь
    // второй клик идёт СРАЗУ, как в QA-сценарии 3.11.
    authRepository.replaceFoodieProfile = vi.fn(() => new Promise<FoodieProfile>(() => {}));
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");
    fireEvent.click(screen.getByRole("button", { name: "Итальянская" }));

    const save = screen.getByRole("button", { name: "Сохранить изменения" });
    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() => expect(authRepository.replaceFoodieProfile).toHaveBeenCalled());
    expect(authRepository.replaceFoodieProfile).toHaveBeenCalledTimes(1);
  });

  it("ревью-фикс: во время PUT плитки/чипы/бюджет заблокированы — правка не теряется молча под «Сохранено»", async () => {
    let resolveSave: (value: FoodieProfile) => void = () => {};
    authRepository.replaceFoodieProfile = vi.fn(
      () => new Promise<FoodieProfile>((resolve) => (resolveSave = resolve)),
    );
    renderFoodie();
    await screen.findByText("Выбрано 0 из 5");

    const italian = screen.getByRole("button", { name: "Итальянская" });
    fireEvent.click(italian);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));
    await waitFor(() => expect(italian.hasAttribute("disabled")).toBe(true));

    // Гость успевает кликнуть аллергию, пока PUT ещё летит — плитка/чип
    // должны быть заблокированы, клик не должен применяться (иначе он
    // потеряется молча в onSuccess ниже, см. критерий 22 спеки).
    const nuts = screen.getByRole("button", { name: "Орехи" });
    expect(nuts.hasAttribute("disabled")).toBe(true);
    fireEvent.click(nuts);
    expect(nuts.getAttribute("aria-pressed")).toBe("false");

    resolveSave(foodieProfile({ cuisines: ["italian"] }));
    await screen.findByText("Сохранено");

    // После ответа сервера поля снова активны, а аллергия (заблокированный
    // клик выше) осталась НЕ выбрана — честно, а не тихо стёрта.
    expect(screen.getByRole("button", { name: "Орехи" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Орехи" }).getAttribute("aria-pressed")).toBe("false");
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
