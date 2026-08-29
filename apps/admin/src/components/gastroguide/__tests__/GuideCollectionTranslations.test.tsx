import type { CityDictionaryEntry, GuideCollection, GuideCollectionInput } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Переводы подборки гастрогида.
 *
 * Ручки гида ДОЛГО принимали полную карту и замещали её целиком; с бэкенда
 * `1252c4c` они принимают тот же частичный патч, что и остальной контент.
 * Разница не косметическая, и именно она здесь и проверяется: полная карта
 * означала, что редактор, поправивший казахский, стирал английский, который
 * коллега написал, пока форма была открыта.
 *
 * Отдельно про `ko`/`zh`: в старых записях гида они есть, кабинет их не правит,
 * а сервер сохраняет нетронутые ключи сам. Значит панель обязана про них
 * МОЛЧАТЬ — не присылать и не пытаться удалить (последнее было бы 422).
 */

const dictionary: { value: CityDictionaryEntry[] } = { value: [] };
vi.mock("@/lib/use-cities", () => ({
  useCityDictionary: () => ({ data: dictionary.value, isPending: false, isError: false }),
}));

const { GuideCollectionFormModal } = await import("../GuideCollectionFormModal");

function collection(over: Partial<GuideCollection> = {}): GuideCollection {
  return {
    id: "gc-1",
    slug: "with-kids",
    kind: "collection",
    title: "С детьми",
    subtitle: "",
    description: "",
    cover_image_url: null,
    city: null,
    status: "draft",
    published_at: null,
    position: 0,
    venue_count: 0,
    category_slugs: [],
    updated_at: "2026-08-01T10:00:00Z",
    ...over,
  };
}

function renderModal(over: Partial<GuideCollection> = {}) {
  // Мок ТИПИЗИРОВАН по аргументам: `vi.fn(async () => …)` выводит пустой кортеж
  // параметров, и `mock.calls[0][1]` тогда не проходит tsc (TS2493).
  const updateGuideCollection = vi.fn(async (_id: string, _input: GuideCollectionInput) =>
    collection(),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GuideCollectionFormModal
        client={{ createGuideCollection: vi.fn(), updateGuideCollection }}
        collection={collection(over)}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return updateGuideCollection;
}

/** Ввод активной вкладки. Доступное имя есть и у поля, и у полосы вкладок
 * («Язык поля «Заголовок»»), поэтому селектор обязателен. */
function titleInput() {
  return screen.getByLabelText<HTMLInputElement>(/^Заголовок/, { selector: "input" });
}

/** Вкладка языка ИМЕННО этого поля: полей с переводами в форме три, и вкладка
 * «Қазақша» есть у каждого. */
function languageTab(field: string, language: RegExp) {
  const tablist = screen.getByRole("tablist", { name: `Язык поля «${field}»` });
  return within(tablist).getByRole("tab", { name: language });
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
}

afterEach(cleanup);

describe("переводы подборки гастрогида — частичный патч, а не полная карта", () => {
  it("правка одного языка не трогает соседний", async () => {
    const update = renderModal({ title_i18n: { kk: "Балалармен", en: "With kids" } });

    fireEvent.click(languageTab("Заголовок", /Қазақша/));
    fireEvent.change(titleInput(), { target: { value: "Балалармен бірге" } });
    save();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const input = update.mock.calls[0]![1] as GuideCollectionInput;
    expect(input.title_i18n).toEqual({ kk: "Балалармен бірге" });
    // Ключа `en` нет — сервер оставит английский как есть. Именно этого и не
    // умела прежняя полная карта.
    expect(input.title_i18n && "en" in input.title_i18n).toBe(false);
  });

  it("пустое поле перевода удаляет язык через null, и об этом сказано заранее", async () => {
    const update = renderModal({ title_i18n: { kk: "Балалармен", en: "With kids" } });

    fireEvent.click(languageTab("Заголовок", /Қазақша/));
    fireEvent.change(titleInput(), { target: { value: "" } });
    expect(
      screen.getByText("Поле пустое — при сохранении перевод будет удалён (Қазақша)."),
    ).toBeTruthy();
    save();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect((update.mock.calls[0]![1] as GuideCollectionInput).title_i18n).toEqual({ kk: null });
  });

  it("ru в карту не уходит ни при каких условиях — русский текст это обычное поле", async () => {
    const update = renderModal({ title_i18n: { ru: "С детьми", kk: "Балалармен" } });

    fireEvent.change(titleInput(), { target: { value: "С детьми в Алматы" } });
    save();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const input = update.mock.calls[0]![1] as GuideCollectionInput;
    expect(input.title).toBe("С детьми в Алматы");
    // Русский текст поехал колонкой; карту переводов не тронули вовсе.
    expect(input.title_i18n).toBeUndefined();
  });

  it("чужие локали старого импорта в патч не попадают", async () => {
    const update = renderModal({ title_i18n: { ko: "아이와 함께", zh: "带孩子" } });

    fireEvent.click(languageTab("Заголовок", /English/));
    fireEvent.change(titleInput(), { target: { value: "With kids" } });
    save();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const input = update.mock.calls[0]![1] as GuideCollectionInput;
    expect(input.title_i18n).toEqual({ en: "With kids" });
    expect(Object.keys(input.title_i18n ?? {})).toEqual(["en"]);
  });

  it("переводы не трогали — ключа в теле нет, остальные поля едут как обычно", async () => {
    const update = renderModal({ title_i18n: { kk: "Балалармен" }, subtitle: "Проверено" });

    fireEvent.change(screen.getByLabelText<HTMLInputElement>(/^Слаг/), {
      target: { value: "with-kids-2" },
    });
    save();

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const input = update.mock.calls[0]![1] as GuideCollectionInput;
    expect(input.slug).toBe("with-kids-2");
    expect(input.title_i18n).toBeUndefined();
    expect(input.subtitle_i18n).toBeUndefined();
    expect(input.description_i18n).toBeUndefined();
  });
});
