import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Story } from "@bookeat/api/admin";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ссылка перехода у сторис.
 *
 * У сторис ДВА разных адреса, и перепутать их — главный риск экрана:
 *   image_url  — где лежит сама картинка (поле «Изображение», внутри него
 *                строка «Или вставьте ссылку»);
 *   action_url — куда уходит гость, если нажмёт на сторис.
 *
 * Тесты закрепляют ровно это: ссылка сохраняется в СВОЁ поле, не подменяет
 * картинку, показывается при повторном открытии формы и снимается пустым
 * значением.
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
    caption: null,
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

beforeEach(() => {
  listStories.mockReset();
  createStory.mockReset();
  updateStory.mockReset();
});
afterEach(cleanup);

describe("сторис: ссылка перехода", () => {
  it("сохраняет ссылку в action_url, а не в адрес картинки", async () => {
    listStories.mockResolvedValue([]);
    createStory.mockResolvedValue(story());

    renderScreen();

    fireEvent.click(await screen.findByText("Добавить сторис"));

    // Адрес КАРТИНКИ — строка внутри блока «Изображение».
    fireEvent.change(screen.getByLabelText("Или вставьте ссылку"), {
      target: { value: "https://pub-x.r2.dev/stories/a.jpg" },
    });
    // Ссылка ПЕРЕХОДА — отдельное поле.
    fireEvent.change(screen.getByLabelText(/Ссылка перехода/), {
      target: { value: "  https://book-eat.com/promo  " },
    });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(createStory).toHaveBeenCalledTimes(1));
    const [restaurantId, input] = createStory.mock.calls[0];
    expect(restaurantId).toBe("r-1");
    expect(input.action_url).toBe("https://book-eat.com/promo");
    // Картинка осталась картинкой — поля не перепутаны.
    expect(input.image_url).toBe("https://pub-x.r2.dev/stories/a.jpg");
  });

  it("это два разных поля: заполненная картинка не заполняет ссылку перехода", async () => {
    listStories.mockResolvedValue([]);
    createStory.mockResolvedValue(story());

    renderScreen();

    fireEvent.click(await screen.findByText("Добавить сторис"));

    const imageField = screen.getByLabelText("Или вставьте ссылку");
    const linkField = screen.getByLabelText(/Ссылка перехода/);
    expect(linkField).not.toBe(imageField);

    fireEvent.change(imageField, { target: { value: "https://pub-x.r2.dev/stories/a.jpg" } });
    expect((linkField as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(createStory).toHaveBeenCalledTimes(1));
    const [, input] = createStory.mock.calls[0];
    expect(input.image_url).toBe("https://pub-x.r2.dev/stories/a.jpg");
    // Картинку в ссылку перехода не подставляем — сторис просто никуда не ведёт.
    expect(input.action_url).toBeNull();
  });

  it("при редактировании показывает сохранённую ссылку и снимает её пустым полем", async () => {
    listStories.mockResolvedValue([story({ action_url: "https://book-eat.com/promo" })]);
    updateStory.mockResolvedValue(story());

    renderScreen();

    fireEvent.click(await screen.findByText("Изменить"));

    const linkField = screen.getByLabelText(/Ссылка перехода/) as HTMLInputElement;
    expect(linkField.value).toBe("https://book-eat.com/promo");

    fireEvent.change(linkField, { target: { value: "" } });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(updateStory).toHaveBeenCalledTimes(1));
    const [storyId, input] = updateStory.mock.calls[0];
    expect(storyId).toBe("s-1");
    expect(input.action_url).toBeNull();
  });

  it("не даёт сохранить ссылку без http(s) и не зовёт сервер", async () => {
    listStories.mockResolvedValue([]);

    renderScreen();

    fireEvent.click(await screen.findByText("Добавить сторис"));
    fireEvent.change(screen.getByLabelText("Или вставьте ссылку"), {
      target: { value: "https://pub-x.r2.dev/stories/a.jpg" },
    });
    fireEvent.change(screen.getByLabelText(/Ссылка перехода/), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByText("Сохранить"));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(createStory).not.toHaveBeenCalled();
  });
});
