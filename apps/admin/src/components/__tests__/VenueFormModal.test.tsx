import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AcquirerAccount, CatalogVenue, KaspiCompany } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Блокер ревью PR #268: карточки «Приём оплаты» и «Kwaaka POS» сохраняются
 * СВОЕЙ кнопкой, отдельно от общей формы заведения. Раньше форма закрывалась
 * по общему «Сохранить»/«Отмена», даже если в карточке висела несохранённая
 * правка — деньги гостей молча продолжали идти на старого провайдера, без
 * единого предупреждения. Тесты ниже держат три вещи:
 *
 *  1. пока в карточке есть несохранённый ввод, форма не закрывается ни по
 *     «Сохранить», ни по «Отмена» — и говорит вслух, почему;
 *  2. у НОВОГО заведения полный успех «Сохранить» не закрывает форму: карточкам
 *     просто негде было взять id заведения раньше этого момента, и молчаливое
 *     закрытие стоило бы админу второго захода в тот же диалог;
 *  3. (2-й круг ревью) кнопки «Повторить кухни/удобства/бесплатную отмену»
 *     раньше звали `onSaved()` напрямую, в обход `requestClose`/
 *     `providerCardsDirty` и в обход правила «новое заведение не закрывается
 *     само» — удавшийся повтор закрывал форму, даже когда карточка оплаты/
 *     Kwaaka стояла несохранённой. Оба сценария закрыты `finishAfterSave`.
 */

let storedAccount: AcquirerAccount = {
  provider: "kaspi",
  connected: false,
  account_ref: "",
  is_active: false,
};
let storedKwaakaId: string | null = null;
let storedLoyaltyEnabled = false;

let freeCancelWindowShouldFailOnce = false;

vi.mock("@/lib/api", () => ({
  apiClient: {
    setFreeCancelWindow: vi.fn(async () => {
      if (freeCancelWindowShouldFailOnce) {
        freeCancelWindowShouldFailOnce = false;
        throw new Error("network");
      }
      return undefined;
    }),
    getAcquirerAccount: vi.fn(async () => storedAccount),
    listKaspiCompanies: vi.fn(async (): Promise<KaspiCompany[]> => [
      { id: "2", name: "ИП САРКУЛИН ДАМИР", status: "active", has_active_session: true, active_cashiers: 1 },
    ]),
    setAcquirerAccount: vi.fn(async (_id: string, input: { account_ref: string; is_active: boolean }) => {
      storedAccount = { provider: "kaspi", connected: true, ...input };
      return storedAccount;
    }),
    getRestaurantKwaakaLink: vi.fn(async () => ({ kwaaka_restaurant_id: storedKwaakaId })),
    getRestaurantLoyalty: vi.fn(async () => ({ loyalty_enabled: storedLoyaltyEnabled })),
    patchRestaurant: vi.fn(
      async (
        _id: string,
        patch: { kwaaka_restaurant_id?: string | null; loyalty_enabled?: boolean },
      ) => {
        if ("kwaaka_restaurant_id" in patch) storedKwaakaId = patch.kwaaka_restaurant_id ?? null;
        if ("loyalty_enabled" in patch) storedLoyaltyEnabled = patch.loyalty_enabled === true;
        return {};
      },
    ),
    getPaymentMethods: vi.fn(async () => ({
      payments_enabled: null,
      payments_enabled_global: true,
      methods: ["kaspi"],
      kaspi_account_bound: true,
    })),
    setPaymentMethods: vi.fn(async () => ({
      payments_enabled: null,
      payments_enabled_global: true,
      methods: ["kaspi"],
      kaspi_account_bound: true,
    })),
    getRestaurantSocialLinks: vi.fn(async () => []),
    getCatalogVenue: vi.fn(async (id: string) => newVenue({ id })),
    getRestaurantCuisines: vi.fn(async () => []),
    getRestaurantFeatures: vi.fn(async () => []),
  },
}));

const { VenueFormModal } = await import("../VenuesView");

function newVenue(overrides: Partial<CatalogVenue> = {}): CatalogVenue {
  return {
    id: "v-1",
    name: "Юрта",
    description: "",
    cuisine_type: "",
    address: "",
    city: "almaty",
    price_category: "",
    email: "",
    phone: "",
    latitude: null,
    longitude: null,
    is_active: true,
    ...overrides,
  };
}

function renderModal(overrides: Partial<Parameters<typeof VenueFormModal>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const saveVenue = vi.fn(async () => newVenue());
  const saveCuisines = vi.fn(async () => undefined);
  const saveFeatures = vi.fn(async () => undefined);
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <VenueFormModal
        title="Новое заведение"
        dictionary={[]}
        featureDictionary={[]}
        cityDictionary={[
          { id: "c-1", code: "almaty", name: "Алматы", value: "almaty", display_order: 1, is_active: true },
        ]}
        saveVenue={saveVenue}
        saveCuisines={saveCuisines}
        saveFeatures={saveFeatures}
        onClose={onClose}
        onSaved={onSaved}
        {...overrides}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onClose, onSaved, saveVenue };
}

afterEach(() => {
  cleanup();
  storedAccount = { provider: "kaspi", connected: false, account_ref: "", is_active: false };
  storedKwaakaId = null;
});

describe("VenueFormModal — провайдерские карточки не сохраняются общей кнопкой (PR #268 fix)", () => {
  it("у нового заведения полный успех «Сохранить» не закрывает форму — иначе карточкам оплаты/Kwaaka негде взять id", async () => {
    const { onSaved, onClose } = renderModal();

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Юрта" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Заведение создано — карточки появились.
    await screen.findByText("Приём оплаты");
    await screen.findByText("Kwaaka POS");

    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("несохранённая смена Kaspi-компании блокирует «Сохранить» и «Отмена» формы", async () => {
    const { onSaved, onClose } = renderModal();

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Юрта" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await screen.findByText("Приём оплаты");

    // Трогаем карточку, НЕ нажимая её собственную кнопку.
    fireEvent.change(await screen.findByLabelText(/Компания в Kaspi/), { target: { value: "2" } });
    await screen.findByText(/несохранённая правка в приёме оплаты, Kwaaka или лояльности/i);

    const cancelButton = screen.getByRole("button", { name: "Отмена" }) as HTMLButtonElement;
    const saveButtons = screen.getAllByRole("button", { name: "Сохранить" }) as HTMLButtonElement[];
    // Общее «Сохранить» формы заперто; карточка сохраняется своей же кнопкой
    // с тем же текстом — обе видны сразу, различаем по состоянию `disabled`.
    expect(cancelButton.disabled).toBe(true);
    const formSaveButton = saveButtons.find((b) => b.disabled);
    const cardSaveButton = saveButtons.find((b) => !b.disabled);
    expect(formSaveButton).toBeTruthy();
    expect(cardSaveButton).toBeTruthy();

    fireEvent.click(cancelButton);
    expect(onClose).not.toHaveBeenCalled();

    // Сохраняем карточку её собственной кнопкой — блокировка снимается.
    fireEvent.click(cardSaveButton!);

    await screen.findByText("Привязка сохранена");
    expect((screen.getByRole("button", { name: "Отмена" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("«Способы оплаты» стоят рядом с «Приёмом оплаты», и их несохранённая правка тоже блокирует закрытие формы", async () => {
    const { onSaved, onClose } = renderModal();

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Юрта" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await screen.findByText("Приём оплаты");
    await screen.findByText("Способы оплаты");

    // Включаем «Карту», не нажимая собственную кнопку карточки.
    fireEvent.click(await screen.findByLabelText(/^Карта \(FreedomPay/));
    await screen.findByText(/несохранённая правка в приёме оплаты, Kwaaka или лояльности/i);
    const cancelButton = screen.getByRole("button", { name: "Отмена" }) as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(true);
    fireEvent.click(cancelButton);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();

    // Возврат прежнего значения снимает блокировку.
    fireEvent.click(screen.getByLabelText(/^Карта \(FreedomPay/));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Отмена" }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("у нового заведения успешный «Повторить бесплатную отмену» тоже не закрывает форму (2-й круг ревью)", async () => {
    freeCancelWindowShouldFailOnce = true;
    const { onSaved, onClose } = renderModal();

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Юрта" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Заведение создалось, а денежное окно — нет: появилась кнопка повтора.
    const retryButton = await screen.findByRole("button", {
      name: "Повторить бесплатную отмену",
    });
    await screen.findByText("Приём оплаты");

    fireEvent.click(retryButton);

    // Повтор проходит успешно на этот раз (мок больше не бросает) — кнопка и
    // текст ошибки исчезают, — но форма не должна закрыться сама: у карточек
    // оплаты/Kwaaka это единственный удобный момент их настроить.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Повторить бесплатную отмену" })).toBeNull();
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("несохранённая карточка блокирует закрытие и через «Повторить бесплатную отмену» у существующего заведения (обход requestClose)", async () => {
    freeCancelWindowShouldFailOnce = true;
    const existingVenue = newVenue({ id: "v-existing" });
    const { onSaved, onClose } = renderModal({ venue: existingVenue });

    // Ждём кабинетное чтение — иначе денежное окно вообще не участвует в
    // сохранении (см. `detailLoaded`/`freeCancelWindowMinutesToSave`). Поле —
    // подпись-`<span>` + хинт внутри одного `<label>` без `htmlFor`, поэтому
    // доступное имя включает текст хинта: матчим по началу, не строкой целиком.
    await waitFor(() => {
      const field = screen.getByLabelText(
        /^Бесплатная отмена, минут до брони/,
      ) as HTMLInputElement;
      expect(field.disabled).toBe(false);
    });

    // Кнопок «Сохранить» тут три (форма + карточка оплаты + Kwaaka) — нужна
    // самая последняя в разметке, кнопка футера формы (после «Отмена»).
    const formSaveButtons = screen.getAllByRole("button", { name: "Сохранить" });
    fireEvent.click(formSaveButtons[formSaveButtons.length - 1]);
    const retryButton = await screen.findByRole("button", {
      name: "Повторить бесплатную отмену",
    });

    // Трогаем карточку оплаты, НЕ сохраняя её собственной кнопкой.
    fireEvent.change(await screen.findByLabelText(/Компания в Kaspi/), {
      target: { value: "2" },
    });
    await screen.findByText(/несохранённая правка в приёме оплаты, Kwaaka или лояльности/i);

    fireEvent.click(retryButton);

    // Обход был именно тут: `retryFreeCancelWindow` звал `onSaved()` напрямую
    // в обход `providerCardsDirty`. Повтор проходит успешно, но форма обязана
    // остаться открытой, пока карточка не сохранена.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Повторить бесплатную отмену" })).toBeNull();
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/несохранённая правка в приёме оплаты, Kwaaka или лояльности/i)).toBeTruthy();
  });

  it("гонка (4-й круг ревью): смена карточки оплаты, ПОКА ответ «Сохранить» ещё в пути, не должна закрыть форму молча", async () => {
    // `finishAfterSave` зовётся уже ПОСЛЕ `await saveVenueWithDictionaries(...)`
    // внутри `submit`, то есть читает `providerCardsDirty` из замыкания на
    // момент клика — старое (чистое) значение. Пока ответ сервера придерживается,
    // трогаем карточку оплаты — она должна успеть стать "грязной" ДО того, как
    // `finishAfterSave` решит, закрывать форму или нет.
    const existingVenue = newVenue({ id: "v-existing" });
    let resolveSave: ((v: CatalogVenue) => void) | undefined;
    const saveVenue = vi.fn(
      () =>
        new Promise<CatalogVenue>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const { onSaved, onClose } = renderModal({ venue: existingVenue, saveVenue });

    // Кнопок «Сохранить» тут три (форма + карточка оплаты + Kwaaka) — нужна
    // самая последняя в разметке, кнопка футера формы.
    const formSaveButtons = screen.getAllByRole("button", { name: "Сохранить" });
    fireEvent.click(formSaveButtons[formSaveButtons.length - 1]);
    await waitFor(() => expect(saveVenue).toHaveBeenCalled());

    // Ответ ещё придерживается — меняем компанию в Kaspi, не сохраняя карточку
    // её собственной кнопкой.
    fireEvent.change(await screen.findByLabelText(/Компания в Kaspi/), {
      target: { value: "2" },
    });
    await screen.findByText(/несохранённая правка в приёме оплаты, Kwaaka или лояльности/i);

    // Теперь отпускаем ответ «Сохранить».
    resolveSave!(newVenue({ id: "v-existing" }));

    // Форма обязана остаться открытой: правка карточки случилась уже после
    // клика, но до того, как сервер ответил.
    await waitFor(() => {
      expect(screen.getByText(/несохранённая правка в приёме оплаты, Kwaaka или лояльности/i)).toBeTruthy();
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
