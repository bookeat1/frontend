import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RepositoryError, type RestaurantSummary } from "@bookeat/api/client";

import { FAVORITES_KEY } from "@web/lib/query-keys";
import { repositoryStub, venueSummary } from "@web/test/harness";

/**
 * Избранное на сайте: оптимистичное переключение и ОТКАТ.
 *
 * Проверяется именно то, чего не видно глазами и что легче всего сломать
 * правкой: сердце закрашивается ДО ответа сервера, а при отказе возвращается в
 * прежнее состояние. Без отката гость остаётся с ложным «сохранено» — хуже,
 * чем если бы кнопка просто не сработала.
 *
 * Отказы намеренно разные: обрыв связи и 401. Второй важнее — на нём
 * `AuthProvider` завершает сессию, и откат должен случиться всё равно.
 */

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

/** Вход подменяется, а не поднимается по-настоящему: этот тест про кэш и
 * мутацию, а не про OTP. Значение читается из переменной, чтобы один и тот же
 * набор проверок прогнать и за вошедшего, и за гостя. */
let signedIn = true;

vi.mock("@web/lib/auth", () => ({
  useAuth: () => ({ user: null, isLoading: false, signedIn, completeSignIn: vi.fn(), signOut: vi.fn() }),
}));

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/venues/venue-1",
  useSearchParams: () => new URLSearchParams(""),
}));

const { useFavoriteControl } = await import("@web/lib/favorites");
const { useFavoriteIds } = await import("@web/lib/queries");

function Heart({ id }: { id: string }) {
  const favorites = useFavoriteIds();
  const props = useFavoriteControl();
  const { favorite, favoritePending, onToggleFavorite } = props(id);
  return (
    <button
      type="button"
      onClick={onToggleFavorite}
      disabled={favoritePending}
      aria-pressed={favorite}
      aria-label="Избранное"
      data-loaded={favorites.isSuccess ? "yes" : "no"}
    >
      {favorite ? "saved" : "not saved"}
    </button>
  );
}

function renderHeart(ids: string[] = ["venue-1"]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      {ids.map((id) => (
        <Heart key={id} id={id} />
      ))}
    </QueryClientProvider>,
  );
  return { ...view, client };
}

/**
 * Заглушка сервера ДЕРЖИТ СОСТОЯНИЕ, а не отвечает пустотой на всё.
 *
 * Это не украшательство: после успешной мутации хук перезапрашивает список
 * (`onSettled` → `invalidateQueries`), и заглушка, которая всегда отдаёт
 * пустой массив, погасила бы только что закрашенное сердце. Тест бы «поймал
 * баг», которого нет, а настоящий откат при отказе — не поймал бы.
 */
let stored: Set<string>;

/**
 * ЗАМОРОЗИТЬ ПЕРЕЗАПРОС после первой выдачи.
 *
 * Без этого проверка отката ничего не проверяет: после отказа мутация всё
 * равно зовёт `invalidateQueries`, список приезжает заново и сам по себе
 * возвращает сердце в исходное состояние. Тест был бы зелёным и с ВЫРЕЗАННЫМ
 * `onError` — проверено, вырезал. Заморозив второй ответ, оставляем ровно один
 * механизм, который может вернуть состояние: откат.
 */
function freezeRefetchAfterFirstAnswer() {
  let answered = false;
  repository.getFavorites = vi.fn((): Promise<RestaurantSummary[]> => {
    if (answered) return new Promise<RestaurantSummary[]>(() => {});
    answered = true;
    return Promise.resolve([...stored].map((id) => venueSummary({ id })));
  });
}

beforeEach(() => {
  signedIn = true;
  push.mockClear();
  stored = new Set<string>();
  repository.getFavorites = vi.fn(async () =>
    [...stored].map((id) => venueSummary({ id })),
  );
  repository.addFavorite = vi.fn(async (id: string) => {
    stored.add(id);
  });
  repository.removeFavorite = vi.fn(async (id: string) => {
    stored.delete(id);
  });
});

describe("избранное", () => {
  it("закрашивает сердце ДО ответа сервера и оставляет закрашенным после", async () => {
    let release: () => void = () => {};
    repository.addFavorite = vi.fn(
      (id: string) =>
        new Promise<void>((resolve) => {
          release = () => {
            stored.add(id);
            resolve();
          };
        }),
    );

    renderHeart();
    const button = await screen.findByRole("button", { name: "Избранное" });
    await waitFor(() => expect(button.dataset.loaded).toBe("yes"));

    fireEvent.click(button);

    // Ответа ещё нет, а состояние уже переключилось — это и есть оптимизм.
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
    expect(repository.addFavorite).toHaveBeenCalledWith("venue-1");
    // И на время полёта кнопка заблокирована: второй клик не должен уехать
    // вторым запросом с противоположным значением.
    expect((button as HTMLButtonElement).disabled).toBe(true);

    release();
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  /**
   * Отказ приходит НЕ МГНОВЕННО, а по команде теста. Иначе проверка
   * бессмысленна: `aria-pressed` равен `false` и в самом начале, до
   * оптимистичной закраски, и первый же опрос `waitFor` проходит, не увидев
   * ни закраски, ни отката. Порядок обязателен: дождаться `true`, отпустить
   * отказ, дождаться `false`.
   */
  async function rollbackIsSeen(failure: unknown) {
    freezeRefetchAfterFirstAnswer();
    let reject: (error: unknown) => void = () => {};
    repository.addFavorite = vi.fn(
      () =>
        new Promise<void>((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );

    renderHeart();
    const button = await screen.findByRole("button", { name: "Избранное" });
    await waitFor(() => expect(button.dataset.loaded).toBe("yes"));

    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));

    reject(failure);
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("false"));
  }

  it("обрыв связи ОТКАТЫВАЕТ сердце, а не оставляет ложное «сохранено»", async () => {
    await rollbackIsSeen(
      new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true),
    );
  });

  it("401 тоже откатывает: сессия кончилась, но врать гостю нельзя", async () => {
    await rollbackIsSeen(new RepositoryError("unauthorized", undefined, 401));
  });

  it("снятие избранного тоже оптимистично и тоже откатывается", async () => {
    stored.add("venue-1");
    freezeRefetchAfterFirstAnswer();
    repository.removeFavorite = vi.fn(async () => {
      throw new RepositoryError("boom", undefined, 500);
    });

    renderHeart();
    const button = await screen.findByRole("button", { name: "Избранное" });
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(button);

    await waitFor(() => expect(repository.removeFavorite).toHaveBeenCalledWith("venue-1"));
    // Сервер отказал — сердце ВОЗВРАЩАЕТСЯ закрашенным, и вернуть его может
    // только откат: перезапрос заморожен.
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
  });

  it("нажали ДО загрузки списка, запрос упал — кэш чист, а не выдуман", async () => {
    // Гость успел раньше `GET /favorites`. Оптимистичное множество в этом
    // случае придумано клиентом целиком: снимка «как было» не существует.
    // Прежний откат (`if (context?.previous)`) в этой ветке не срабатывал
    // вовсе, и сердце оставалось закрашенным навсегда — сеть упала и у
    // мутации, и у перезапроса.
    let answerList: () => void = () => {};
    repository.getFavorites = vi.fn(
      () =>
        new Promise<RestaurantSummary[]>((resolve) => {
          answerList = () => resolve([]);
        }),
    );
    let rejectAdd: (error: unknown) => void = () => {};
    repository.addFavorite = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectAdd = reject;
        }),
    );

    const { client } = renderHeart();
    const button = await screen.findByRole("button", { name: "Избранное" });
    // Список ещё НЕ приехал.
    expect(button.dataset.loaded).toBe("no");

    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));

    rejectAdd(new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true));

    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("false"));
    // И в кэше не осталось придуманного множества, выданного за ответ сервера.
    expect(client.getQueryData(FAVORITES_KEY)).toBeUndefined();

    // Перезапрос при этом живой: наблюдатель просит список заново, и когда он
    // приходит, экран показывает его, а не пустоту навсегда.
    answerList();
    await waitFor(() => expect(button.dataset.loaded).toBe("yes"));
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("падение одной карточки не стирает оптимистику соседней", async () => {
    // A и B нажаты подряд. A снял бы снимок пустого множества, B — снимок
    // `{A}`; откат снимком вернул бы пустое множество и убрал B, хотя запрос B
    // ещё летит. Откат обязан трогать ТОЛЬКО свой id.
    freezeRefetchAfterFirstAnswer();
    const pending = new Map<string, { reject: (error: unknown) => void }>();
    repository.addFavorite = vi.fn(
      (id: string) =>
        new Promise<void>((_resolve, reject) => {
          pending.set(id, { reject });
        }),
    );

    const { client } = renderHeart(["venue-a", "venue-b"]);
    const [heartA, heartB] = screen.getAllByRole("button", { name: "Избранное" });
    await waitFor(() => expect(heartA.dataset.loaded).toBe("yes"));

    fireEvent.click(heartA);
    await waitFor(() => expect(heartA.getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(heartB);
    await waitFor(() => expect(heartB.getAttribute("aria-pressed")).toBe("true"));

    pending.get("venue-a")?.reject(new RepositoryError("boom", undefined, 500));

    await waitFor(() => expect(heartA.getAttribute("aria-pressed")).toBe("false"));
    // Вот это и ломал откат снимком.
    expect(heartB.getAttribute("aria-pressed")).toBe("true");
    expect(client.getQueryData<Set<string>>(FAVORITES_KEY)?.has("venue-b")).toBe(true);
  });

  it("второе нажатие в полёте НЕ уходит вторым запросом", async () => {
    // Идемпотентность ручек тут не спасает: параллельные PUT и DELETE могут
    // прийти на сервер в обратном порядке, и сохранённым останется то, что
    // гость снял последним действием. Спасает только блокировка.
    freezeRefetchAfterFirstAnswer();
    repository.addFavorite = vi.fn(() => new Promise<void>(() => {}));

    renderHeart();
    const button = await screen.findByRole("button", { name: "Избранное" });
    await waitFor(() => expect(button.dataset.loaded).toBe("yes"));

    fireEvent.click(button);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(button);
    fireEvent.click(button);

    expect(repository.addFavorite).toHaveBeenCalledTimes(1);
    expect(repository.removeFavorite).not.toHaveBeenCalled();
  });

  it("гость без входа уходит на вход С АДРЕСОМ ВОЗВРАТА и в сеть не ходит", async () => {
    signedIn = false;
    window.history.replaceState({}, "", "/venues?cuisines=european");

    renderHeart();
    const button = await screen.findByRole("button", { name: "Избранное" });

    fireEvent.click(button);

    expect(push).toHaveBeenCalledWith("/login?next=%2Fvenues%3Fcuisines%3Deuropean");
    expect(repository.addFavorite).not.toHaveBeenCalled();
    // И список избранного у гостя не запрашивался: ручка требует сессию.
    expect(repository.getFavorites).not.toHaveBeenCalled();
  });
});
