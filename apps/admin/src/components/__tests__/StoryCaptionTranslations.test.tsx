import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Story } from "@bookeat/api/admin";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Переводы подписи сторис в живой форме.
 *
 * Форма выбрана самая простая из тех, куда встроен редактор, — здесь одно
 * переводимое поле, и ничто не отвлекает от того, что проверяется:
 *
 *   1. НА ПРОВОД УХОДИТ ТОЛЬКО ТРОНУТЫЙ ЯЗЫК. Ключ второго языка в теле
 *      отсутствовать ОБЯЗАН: сервер понимает `caption_i18n` как частичное
 *      обновление, и перечислить там английский — значит переписать правку,
 *      которую кто-то сделал, пока форма была открыта.
 *   2. ПУСТОЕ ПОЛЕ ПЕРЕВОДА — ЭТО `null`, то есть удаление, и форма говорит об
 *      этом до нажатия «Сохранить».
 *   3. ОТСУТСТВИЕ ПЕРЕВОДА ВИДНО, не открывая вкладку.
 *   4. 422 ОБЪЯСНЯЕТСЯ ПО-РУССКИ, а набранное остаётся в полях.
 */

const listStories = vi.fn();
const createStory = vi.fn();
const updateStory = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    listStories: (...args: unknown[]) => listStories(...args),
    createStory: (...args: unknown[]) => createStory(...args),
    updateStory: (...args: unknown[]) => updateStory(...args),
    deleteStory: vi.fn(),
    reorderStories: vi.fn(),
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ restaurant: { id: "r-1" } }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

const { StoriesView } = await import("../StoriesView");

function story(over: Partial<Story> = {}): Story {
  return {
    id: "s-1",
    image_url: "https://pub-x.r2.dev/stories/a.jpg",
    caption: "Ужин у моря",
    action_url: null,
    sort_order: 0,
    is_active: true,
    expires_at: null,
    is_expired: false,
    created_at: "2026-08-01T10:00:00Z",
    ...over,
  };
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StoriesView />
    </QueryClientProvider>,
  );
}

/** Поле активной вкладки. У подписи с переводами доступное имя есть и у ввода,
 * и у полосы вкладок языка, поэтому селектор обязателен. */
function captionInput() {
  return screen.getByLabelText<HTMLTextAreaElement>(/^Подпись/, { selector: "textarea" });
}

beforeEach(() => {
  listStories.mockReset();
  createStory.mockReset();
  updateStory.mockReset();
});
afterEach(cleanup);

describe("сторис: переводы подписи", () => {
  it("уходит только изменённый язык — ключа второго в теле нет", async () => {
    listStories.mockResolvedValue([
      story({ caption_i18n: { kk: "Теңіз жағасындағы кешкі ас", en: "Dinner by the sea" } }),
    ]);
    updateStory.mockResolvedValue(story());

    renderScreen();
    fireEvent.click(await screen.findByText("Изменить"));

    fireEvent.click(screen.getByRole("tab", { name: /Қазақша/ }));
    fireEvent.change(captionInput(), { target: { value: "Жаңа мәтін" } });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(updateStory).toHaveBeenCalledTimes(1));
    const [, input] = updateStory.mock.calls[0];
    expect(input.caption_i18n).toEqual({ kk: "Жаңа мәтін" });
    expect("en" in input.caption_i18n).toBe(false);
    // Русский текст правится обычным полем и в карту не попадает никогда.
    expect("ru" in input.caption_i18n).toBe(false);
    expect(input.caption).toBe("Ужин у моря");
  });

  it("переводы не трогали — ключа caption_i18n в теле нет вовсе", async () => {
    listStories.mockResolvedValue([story({ caption_i18n: { kk: "Кешкі ас" } })]);
    updateStory.mockResolvedValue(story());

    renderScreen();
    fireEvent.click(await screen.findByText("Изменить"));
    fireEvent.change(captionInput(), { target: { value: "Ужин у моря, 19:00" } });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(updateStory).toHaveBeenCalledTimes(1));
    const [, input] = updateStory.mock.calls[0];
    expect(input.caption_i18n).toBeUndefined();
    expect(input.caption).toBe("Ужин у моря, 19:00");
  });

  it("пустое поле перевода = удалить язык, и об этом сказано до сохранения", async () => {
    listStories.mockResolvedValue([story({ caption_i18n: { kk: "Кешкі ас" } })]);
    updateStory.mockResolvedValue(story());

    renderScreen();
    fireEvent.click(await screen.findByText("Изменить"));

    fireEvent.click(screen.getByRole("tab", { name: /Қазақша/ }));
    fireEvent.change(captionInput(), { target: { value: "" } });

    expect(
      screen.getByText("Поле пустое — при сохранении перевод будет удалён (Қазақша)."),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(updateStory).toHaveBeenCalledTimes(1));
    const [, input] = updateStory.mock.calls[0];
    expect(input.caption_i18n).toEqual({ kk: null });
  });

  it("отсутствие перевода видно на самой вкладке", async () => {
    listStories.mockResolvedValue([story({ caption_i18n: { en: "Dinner by the sea" } })]);

    renderScreen();
    fireEvent.click(await screen.findByText("Изменить"));

    expect(screen.getByRole("tab", { name: "Қазақша: перевода нет" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "English: перевод есть" })).toBeTruthy();
  });

  it("422 объясняется по-русски, и набранное не выбрасывается", async () => {
    const { RepositoryError } = await import("@bookeat/api");
    listStories.mockResolvedValue([story()]);
    updateStory.mockRejectedValue(new RepositoryError("validation failed", undefined, 422));

    renderScreen();
    fireEvent.click(await screen.findByText("Изменить"));

    fireEvent.click(screen.getByRole("tab", { name: /Қазақша/ }));
    fireEvent.change(captionInput(), { target: { value: "Кешкі ас" } });
    fireEvent.click(screen.getByText("Сохранить"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Сервер не принял данные формы. Ничего не сохранилось — проверьте поля и переводы",
    );
    // Форма осталась открытой с тем, что человек набрал.
    expect(captionInput().value).toBe("Кешкі ас");
  });
});
