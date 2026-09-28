import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AcquirerAccount, CatalogVenue, KaspiCompany } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Блокер ревью PR #268: карточки «Приём оплаты» и «Kwaaka POS» сохраняются
 * СВОЕЙ кнопкой, отдельно от общей формы заведения. Раньше форма закрывалась
 * по общему «Сохранить»/«Отмена», даже если в карточке висела несохранённая
 * правка — деньги гостей молча продолжали идти на старого провайдера, без
 * единого предупреждения. Тесты ниже держат две вещи:
 *
 *  1. пока в карточке есть несохранённый ввод, форма не закрывается ни по
 *     «Сохранить», ни по «Отмена» — и говорит вслух, почему;
 *  2. у НОВОГО заведения полный успех «Сохранить» не закрывает форму: карточкам
 *     просто негде было взять id заведения раньше этого момента, и молчаливое
 *     закрытие стоило бы админу второго захода в тот же диалог.
 */

let storedAccount: AcquirerAccount = {
  provider: "kaspi",
  connected: false,
  account_ref: "",
  is_active: false,
};
let storedKwaakaId: string | null = null;

vi.mock("@/lib/api", () => ({
  apiClient: {
    setFreeCancelWindow: vi.fn(async () => undefined),
    getAcquirerAccount: vi.fn(async () => storedAccount),
    listKaspiCompanies: vi.fn(async (): Promise<KaspiCompany[]> => [
      { id: "2", name: "ИП САРКУЛИН ДАМИР", status: "active", has_active_session: true, active_cashiers: 1 },
    ]),
    setAcquirerAccount: vi.fn(async (_id: string, input: { account_ref: string; is_active: boolean }) => {
      storedAccount = { provider: "kaspi", connected: true, ...input };
      return storedAccount;
    }),
    getRestaurantKwaakaLink: vi.fn(async () => ({ kwaaka_restaurant_id: storedKwaakaId })),
    patchRestaurant: vi.fn(async (_id: string, patch: { kwaaka_restaurant_id: string | null }) => {
      storedKwaakaId = patch.kwaaka_restaurant_id;
      return {};
    }),
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
    await screen.findByText(/несохранённая правка в приёме оплаты или Kwaaka/i);

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
});
