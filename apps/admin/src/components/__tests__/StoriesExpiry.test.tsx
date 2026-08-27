import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Story } from "@bookeat/api/admin";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Срок жизни сторис в кабинете заведения.
 *
 * Продуктовое решение владельца: срок НЕОБЯЗАТЕЛЬНЫЙ, а форма ПРЕДЛАГАЕТ сутки.
 * Из этого следуют три вещи, которые тут и закреплены:
 *
 *   1. при создании поле «Показывать до» предзаполнено на 24 часа вперёд, но
 *      его можно очистить — тогда сторис бессрочная, как все существующие;
 *   2. при редактировании показывается СВОЙ срок сторис, а у бессрочной поле
 *      пустое: подставить туда «+24 часа» значило бы молча повесить срок на
 *      карточку, которую заведение сознательно оставило вечной;
 *   3. просроченная сторис ОСТАЁТСЯ в списке с пометкой — её нужно уметь
 *      продлить, а не искать пропавшую с собственного экрана.
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

const expiryField = () => screen.getByLabelText(/Показывать до/) as HTMLInputElement;

beforeEach(() => {
  listStories.mockReset();
  createStory.mockReset();
  updateStory.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("сторис: срок показа", () => {
  it("при создании предлагает сутки вперёд", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T09:00:00Z"));
    listStories.mockResolvedValue([]);
    createStory.mockResolvedValue(story());

    renderScreen();
    // Списочный запрос уже отрезолвился в фейковых таймерах — ждём кнопку.
    await vi.waitFor(() => screen.getByText("Добавить сторис"));
    fireEvent.click(screen.getByText("Добавить сторис"));

    // Ровно +24 часа от «сейчас», в настенном времени этого устройства —
    // ту же конвертацию делают формы событий и акций.
    const expected = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(expiryField().value).toBe(
      `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}` +
        `T${pad(expected.getHours())}:${pad(expected.getMinutes())}`,
    );
  });

  it("предложенный срок можно снять — тогда сторис бессрочная", async () => {
    listStories.mockResolvedValue([]);
    createStory.mockResolvedValue(story());

    renderScreen();
    fireEvent.click(await screen.findByText("Добавить сторис"));
    fireEvent.change(screen.getByLabelText("Или вставьте ссылку"), {
      target: { value: "https://pub-x.r2.dev/stories/a.jpg" },
    });
    expect(expiryField().value).not.toBe("");

    fireEvent.click(screen.getByText("Без срока"));
    expect(expiryField().value).toBe("");

    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(createStory).toHaveBeenCalledTimes(1));
    const [, input] = createStory.mock.calls[0];
    expect(input.expires_at).toBeNull();
  });

  it("выбранный момент уходит на сервер как абсолютный RFC3339", async () => {
    listStories.mockResolvedValue([]);
    createStory.mockResolvedValue(story());

    renderScreen();
    fireEvent.click(await screen.findByText("Добавить сторис"));
    fireEvent.change(screen.getByLabelText("Или вставьте ссылку"), {
      target: { value: "https://pub-x.r2.dev/stories/a.jpg" },
    });
    fireEvent.change(expiryField(), { target: { value: "2026-08-28T18:30" } });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(createStory).toHaveBeenCalledTimes(1));
    const [, input] = createStory.mock.calls[0];
    // Настенное время устройства -> момент. Сравниваем с тем же переводом, а не
    // с зашитой строкой: тест не должен зависеть от таймзоны машины CI.
    expect(input.expires_at).toBe(new Date("2026-08-28T18:30").toISOString());
  });

  it("при редактировании бессрочной сторис поле пустое — срок не навязывается", async () => {
    listStories.mockResolvedValue([story({ expires_at: null })]);
    updateStory.mockResolvedValue(story());

    renderScreen();
    fireEvent.click(await screen.findByText("Изменить"));

    expect(expiryField().value).toBe("");
  });

  it("показывает сохранённый срок и снимает его пустым полем", async () => {
    const iso = new Date("2026-09-01T12:00").toISOString();
    listStories.mockResolvedValue([story({ expires_at: iso })]);
    updateStory.mockResolvedValue(story());

    renderScreen();
    fireEvent.click(await screen.findByText("Изменить"));
    expect(expiryField().value).toBe("2026-09-01T12:00");

    fireEvent.change(expiryField(), { target: { value: "" } });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(updateStory).toHaveBeenCalledTimes(1));
    const [storyId, input] = updateStory.mock.calls[0];
    expect(storyId).toBe("s-1");
    expect(input.expires_at).toBeNull();
  });

  it("просроченная сторис остаётся в списке с пометкой и её можно продлить", async () => {
    listStories.mockResolvedValue([
      story({ expires_at: "2026-08-01T12:00:00Z", is_expired: true }),
    ]);
    updateStory.mockResolvedValue(story());

    renderScreen();

    // Не исчезла: карточка на месте, и рядом с ней сказано, что срок вышел.
    expect(await screen.findByText("Срок вышел")).toBeTruthy();
    expect(screen.getByText("Всего: 1")).toBeTruthy();

    // И её можно продлить, не трогая переключатель показа.
    fireEvent.click(screen.getByText("Изменить"));
    fireEvent.change(expiryField(), { target: { value: "2026-12-31T23:59" } });
    fireEvent.click(screen.getByText("Сохранить"));

    await waitFor(() => expect(updateStory).toHaveBeenCalledTimes(1));
    const [, input] = updateStory.mock.calls[0];
    expect(input.expires_at).toBe(new Date("2026-12-31T23:59").toISOString());
    expect(input.is_active).toBe(true);
  });

  it("бейдж «Срок вышел» берётся с сервера, а не из часов браузера", async () => {
    // Срок в далёком прошлом, но сервер сказал is_expired: false — например,
    // часы на ноутбуке администратора убежали вперёд. Верим серверу.
    listStories.mockResolvedValue([
      story({ expires_at: "2020-01-01T00:00:00Z", is_expired: false }),
    ]);

    renderScreen();

    await screen.findByText("Всего: 1");
    expect(screen.queryByText("Срок вышел")).toBeNull();
  });
});
