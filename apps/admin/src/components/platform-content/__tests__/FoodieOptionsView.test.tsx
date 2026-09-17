import type {
  CuisineDictionaryEntry,
  FoodieOptionEntry,
  FoodieOptionSaveInput,
  FoodieOptionsAdminResponse,
} from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «Фуди-профиль» — справочник плиток визарда (спека
 * foodie-profile-admin-dictionaries-20260916.md, FE-A1).
 *
 * Главное, что тут закреплено: четыре вкладки читают ОДИН ответ бакетом
 * ({cuisines, diets, allergies, budgets}), а не четыре запроса; кнопка
 * «Скрыть» блокируется на клиенте для `no_diet` и для последнего активного
 * варианта своего вида — до того, как сервер вообще успел бы ответить 422;
 * мультивыбор кухонь заведений виден только на вкладке «Кухни» и уходит
 * ЦЕЛИКОМ (`cuisine_ids`), не дельтой.
 */

const auth = { role: "admin" as string, token: "t" as string | null };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1", role: auth.role }, token: auth.token }),
}));

const { FoodieOptionsView } = await import("../FoodieOptionsView");

function option(over: Partial<FoodieOptionEntry> = {}): FoodieOptionEntry {
  return {
    id: "o-1",
    kind: "cuisine",
    code: "kazakh",
    name: "Казахская",
    cuisine_ids: [],
    cuisine_codes: [],
    display_order: 1,
    is_active: true,
    affects_matching: false,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function emptyBuckets(): FoodieOptionsAdminResponse {
  return { cuisines: [], diets: [], allergies: [], budgets: [] };
}

function cuisineEntry(over: Partial<CuisineDictionaryEntry> = {}): CuisineDictionaryEntry {
  return {
    id: "c-1",
    code: "korean",
    name: "Корейская",
    display_order: 1,
    is_active: true,
    ...over,
  };
}

function fakeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    listFoodieOptionsForAdmin: vi.fn(async () => emptyBuckets()),
    createFoodieOption: vi.fn(async (input: FoodieOptionSaveInput) =>
      option({ id: "o-new", kind: input.kind!, code: input.code ?? "", name: input.name ?? "" }),
    ),
    updateFoodieOption: vi.fn(async (id: string, input: FoodieOptionSaveInput) =>
      option({ id, ...input, kind: input.kind ?? "cuisine" }),
    ),
    hideFoodieOption: vi.fn(async () => option({ is_active: false })),
    listCuisinesForAdmin: vi.fn(async () => [cuisineEntry()]),
    ...over,
  };
}

function renderView(client: ReturnType<typeof fakeClient>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FoodieOptionsView client={client} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.role = "admin";
  auth.token = "t";
});

afterEach(cleanup);

describe("справочник фуди-профиля", () => {
  it("не суперадмину раздел не показывают и данные не запрашивают", () => {
    auth.role = "restaurant";
    const client = fakeClient();
    renderView(client);

    expect(screen.getByText("Раздел только для администраторов платформы")).toBeTruthy();
    expect(client.listFoodieOptionsForAdmin).not.toHaveBeenCalled();
  });

  it("рисует все четыре вкладки и показывает записи своего вида", async () => {
    const client = fakeClient({
      listFoodieOptionsForAdmin: vi.fn(async () => ({
        cuisines: [option({ id: "c1", kind: "cuisine", code: "asian", name: "Азиатская" })],
        diets: [option({ id: "d1", kind: "diet", code: "vegan", name: "Веган" })],
        allergies: [option({ id: "a1", kind: "allergy", code: "nuts", name: "Орехи" })],
        budgets: [option({ id: "b1", kind: "budget", code: "mid", name: "Средний" })],
      })),
    });
    renderView(client);

    expect(await screen.findByText("Азиатская")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Диеты" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Диеты" }));
    expect(await screen.findByText("Веган")).toBeTruthy();
    expect(screen.queryByText("Азиатская")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Бюджет" }));
    expect(await screen.findByText("Средний")).toBeTruthy();
  });

  it("«Влияет на подбор» видна только на вкладке «Кухни»", async () => {
    const client = fakeClient({
      listFoodieOptionsForAdmin: vi.fn(async () => ({
        cuisines: [
          option({ id: "c1", kind: "cuisine", code: "asian", name: "Азиатская", affects_matching: true }),
        ],
        diets: [option({ id: "d1", kind: "diet", code: "vegan", name: "Веган" })],
        allergies: [],
        budgets: [],
      })),
    });
    renderView(client);

    expect(await screen.findByText("Влияет на подбор")).toBeTruthy();
    expect(screen.getByText("Да")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Диеты" }));
    await screen.findByText("Веган");
    expect(screen.queryByText("Влияет на подбор")).toBeNull();
  });

  it("«Без диеты» нельзя скрыть — кнопка недоступна с пояснением", async () => {
    const client = fakeClient({
      listFoodieOptionsForAdmin: vi.fn(async () => ({
        cuisines: [],
        diets: [
          option({ id: "d1", kind: "diet", code: "no_diet", name: "Без диеты" }),
          option({ id: "d2", kind: "diet", code: "vegan", name: "Веган" }),
        ],
        allergies: [],
        budgets: [],
      })),
    });
    renderView(client);

    fireEvent.click(await screen.findByRole("tab", { name: "Диеты" }));
    const hideNoDiet = await screen.findByRole<HTMLButtonElement>("button", {
      name: /Скрыть вариант «Без диеты»/i,
    });
    expect(hideNoDiet.disabled).toBe(true);
    expect(hideNoDiet.title).toContain("Без диеты");

    // Веган — не последний и не no_diet, кнопка активна.
    const hideVegan = screen.getByRole<HTMLButtonElement>("button", {
      name: /Скрыть вариант «Веган»/i,
    });
    expect(hideVegan.disabled).toBe(false);
  });

  it("последний активный вариант своего вида — тоже нельзя скрыть", async () => {
    const client = fakeClient({
      listFoodieOptionsForAdmin: vi.fn(async () => ({
        cuisines: [],
        diets: [],
        allergies: [option({ id: "a1", kind: "allergy", code: "nuts", name: "Орехи" })],
        budgets: [],
      })),
    });
    renderView(client);

    fireEvent.click(await screen.findByRole("tab", { name: "Аллергии" }));
    const hide = await screen.findByRole<HTMLButtonElement>("button", {
      name: /Скрыть вариант «Орехи»/i,
    });
    expect(hide.disabled).toBe(true);
    expect(hide.title).toContain("последний активный");
  });

  it("«Скрыть» уходит в DELETE, «Вернуть» — в PATCH с is_active", async () => {
    const client = fakeClient({
      listFoodieOptionsForAdmin: vi.fn(async () => ({
        cuisines: [],
        diets: [],
        allergies: [
          // Два активных: скрыть один — не «последний активный», разрешено.
          option({ id: "a1", kind: "allergy", code: "nuts", name: "Орехи" }),
          option({ id: "a0", kind: "allergy", code: "lactose", name: "Лактоза" }),
          option({ id: "a2", kind: "allergy", code: "gluten", name: "Глютен", is_active: false }),
        ],
        budgets: [],
      })),
    });
    renderView(client);

    fireEvent.click(await screen.findByRole("tab", { name: "Аллергии" }));
    fireEvent.click(await screen.findByRole("button", { name: /Скрыть вариант «Орехи»/i }));
    await waitFor(() => expect(client.hideFoodieOption).toHaveBeenCalledWith("a1"));

    fireEvent.click(screen.getByRole("button", { name: /Вернуть вариант «Глютен»/i }));
    await waitFor(() =>
      expect(client.updateFoodieOption).toHaveBeenCalledWith("a2", { is_active: true }),
    );
  });

  it("создание на вкладке «Кухни» шлёт kind и выбранную связь кухонь", async () => {
    const client = fakeClient();
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Добавить вариант" }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Корейская" } });
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "korean" } });

    const cuisineCheckbox = await screen.findByRole("checkbox", { name: "Корейская" });
    fireEvent.click(cuisineCheckbox);

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createFoodieOption).toHaveBeenCalledTimes(1));
    const input = client.createFoodieOption.mock.calls[0]![0] as FoodieOptionSaveInput;
    expect(input.kind).toBe("cuisine");
    expect(input.code).toBe("korean");
    expect(input.name).toBe("Корейская");
    expect(input.cuisine_ids).toEqual(["c-1"]);
  });

  it("создание на вкладке «Бюджет» шлёт price_category и не шлёт cuisine_ids", async () => {
    const client = fakeClient();
    renderView(client);

    fireEvent.click(await screen.findByRole("tab", { name: "Бюджет" }));
    fireEvent.click(await screen.findByRole("button", { name: "Добавить вариант" }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Дорого" } });
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "premium" } });

    const tierField = screen.getByLabelText(/^Ярус/);
    fireEvent.change(tierField, { target: { value: "₸₸₸" } });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.createFoodieOption).toHaveBeenCalledTimes(1));
    const input = client.createFoodieOption.mock.calls[0]![0] as FoodieOptionSaveInput;
    expect(input.kind).toBe("budget");
    expect(input.price_category).toBe("₸₸₸");
    expect(input.cuisine_ids).toBeUndefined();
  });

  it("правка не даёт менять код — поле недоступно и в PATCH код не уходит", async () => {
    const client = fakeClient({
      listFoodieOptionsForAdmin: vi.fn(async () => ({
        cuisines: [],
        diets: [option({ id: "d1", kind: "diet", code: "vegan", name: "Веган" })],
        allergies: [],
        budgets: [],
      })),
    });
    renderView(client);

    fireEvent.click(await screen.findByRole("tab", { name: "Диеты" }));
    fireEvent.click(await screen.findByRole("button", { name: /Изменить вариант «Веган»/i }));

    const codeInput = screen.getByLabelText(/^Код/) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
    expect(codeInput.value).toBe("vegan");

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Веганское" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(client.updateFoodieOption).toHaveBeenCalledWith(
        "d1",
        expect.objectContaining({ name: "Веганское" }),
      ),
    );
    const input = client.updateFoodieOption.mock.calls[0]![1] as FoodieOptionSaveInput;
    expect(input.code).toBeUndefined();
    expect(input.kind).toBeUndefined();
  });

  it("плитка связана со скрытой кухней — связь видна отдельно и её можно снять (код-ревью 2026-09-17)", async () => {
    // Без этого блока правка такой плитки была невозможна: cuisine_ids всегда
    // уходит целиком, а чекбокса на скрытую кухню в списке активных не было —
    // сохранение падало 422 у самого сервера, и отвязать было нечем.
    const client = fakeClient({
      listFoodieOptionsForAdmin: vi.fn(async () => ({
        cuisines: [option({ id: "t1", code: "korean", name: "Корейская", cuisine_ids: ["c-hidden"] })],
        diets: [],
        allergies: [],
        budgets: [],
      })),
      listCuisinesForAdmin: vi.fn(async () => [
        cuisineEntry({ id: "c-active", code: "asian", name: "Азиатская", is_active: true }),
        cuisineEntry({ id: "c-hidden", code: "spicy", name: "Острая", is_active: false }),
      ]),
    });
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: /Изменить вариант «Корейская»/i }));

    // Скрытая, но связанная — отдельным блоком, отмечена, с пометкой.
    const hiddenCheckbox = await screen.findByRole("checkbox", { name: "Острая (скрыта)" });
    expect((hiddenCheckbox as HTMLInputElement).checked).toBe(true);
    // Активная — в обычном списке, не отмечена.
    const activeCheckbox = screen.getByRole("checkbox", { name: "Азиатская" }) as HTMLInputElement;
    expect(activeCheckbox.checked).toBe(false);

    // Можно сохранить как есть — 422 не проверяем (это уже дело сервера),
    // важно, что клиент не молча теряет связь.
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(client.updateFoodieOption).toHaveBeenCalledTimes(1));
    expect((client.updateFoodieOption.mock.calls[0]![1] as FoodieOptionSaveInput).cuisine_ids).toEqual([
      "c-hidden",
    ]);

    // Успешный save закрывает модалку — открываем правку заново, снимаем
    // галочку: связь уходит из следующего сохранения.
    fireEvent.click(await screen.findByRole("button", { name: /Изменить вариант «Корейская»/i }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Острая (скрыта)" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(client.updateFoodieOption).toHaveBeenCalledTimes(2));
    expect((client.updateFoodieOption.mock.calls[1]![1] as FoodieOptionSaveInput).cuisine_ids).toEqual([]);
  });

  it("сервер отказал 409 — форма показывает дубликат и не теряет введённое", async () => {
    const { AdminApiError } = await import("@bookeat/api/admin");
    const client = fakeClient({
      createFoodieOption: vi.fn(async () => {
        throw new AdminApiError("conflict", 409);
      }),
    });
    renderView(client);

    fireEvent.click(await screen.findByRole("button", { name: "Добавить вариант" }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Корейская" } });
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "korean" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Такой код или название уже есть в этом виде",
    );
    expect(screen.getByLabelText(/^Название/)).toHaveProperty("value", "Корейская");
  });

  it("пустая вкладка и упавшая загрузка — разные экраны", async () => {
    const empty = fakeClient();
    const { unmount } = renderView(empty);
    expect(await screen.findByText("Вариантов пока нет")).toBeTruthy();
    unmount();

    const failing = fakeClient({
      listFoodieOptionsForAdmin: vi.fn(async () => {
        throw new Error("нет сети");
      }),
    });
    renderView(failing);
    expect(await screen.findByText("Справочник не загрузился")).toBeTruthy();
  });
});
