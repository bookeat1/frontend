import { getDictionary } from "@bookeat/i18n";
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GREETING_HOURS, homeGreeting, partOfDay, usePartOfDay } from "../greeting";

/**
 * Приветствие в шапке главной — ЛОГИКА, а не текст: гость и вошедший видят
 * разное, вошедший видит разное в разное время суток, и всё это считается по
 * часам ЕГО устройства.
 *
 * Время во всех тестах задаётся явно (`localDate`), настоящие часы машины не
 * участвуют — иначе набор был бы зелёным только с 12 до 18.
 */

const ru = getDictionary("ru");
const en = getDictionary("en");
const kk = getDictionary("kk");

/** Момент в МЕСТНОМ поясе прогона (в setup он зафиксирован Asia/Almaty). */
function localDate(hour: number, minute: number): Date {
  return new Date(2026, 7, 24, hour, minute, 0, 0);
}

function signedIn(at: Date, name = "Дамир"): string {
  return homeGreeting({
    authStatus: "signed-in",
    firstName: name,
    part: partOfDay(at),
    strings: ru.explore.greetings,
  });
}

describe("partOfDay — границы суток", () => {
  it.each([
    [4, 59, "night"],
    [5, 0, "morning"],
    [11, 59, "morning"],
    [12, 0, "afternoon"],
    [17, 59, "afternoon"],
    [18, 0, "evening"],
    [22, 59, "evening"],
    [23, 0, "night"],
    // Полночь — внутри ночного интервала, который переходит через сутки.
    [0, 0, "night"],
  ])("%s:%s → %s", (hour, minute, expected) => {
    expect(partOfDay(localDate(hour as number, minute as number))).toBe(expected);
  });

  it("границы живут в одной константе, а не в компоненте", () => {
    expect(GREETING_HOURS).toEqual({
      morningStartsAt: 5,
      afternoonStartsAt: 12,
      eveningStartsAt: 18,
      nightStartsAt: 23,
    });
  });

  it("считает по МЕСТНОМУ времени устройства, а не по UTC", () => {
    // 23:30 в Asia/Almaty — это 18:30 UTC. Если бы читались часы UTC,
    // получился бы «вечер».
    const at = localDate(23, 30);
    expect(at.getUTCHours()).not.toBe(at.getHours());
    expect(partOfDay(at)).toBe("night");
  });
});

describe("homeGreeting", () => {
  it("гость видит «Добро пожаловать» без имени в любое время суток", () => {
    for (const hour of [0, 5, 12, 18, 23]) {
      const text = homeGreeting({
        authStatus: "signed-out",
        firstName: "Дамир",
        part: partOfDay(localDate(hour, 0)),
        strings: ru.explore.greetings,
      });
      expect(text).toBe("Добро пожаловать");
    }
  });

  it("вошедший видит приветствие по времени суток, имя — на ВТОРОЙ строке", () => {
    expect(signedIn(localDate(4, 59))).toBe("Доброй ночи,\nДамир");
    expect(signedIn(localDate(5, 0))).toBe("Доброе утро,\nДамир");
    expect(signedIn(localDate(11, 59))).toBe("Доброе утро,\nДамир");
    expect(signedIn(localDate(12, 0))).toBe("Добрый день,\nДамир");
    expect(signedIn(localDate(17, 59))).toBe("Добрый день,\nДамир");
    expect(signedIn(localDate(18, 0))).toBe("Добрый вечер,\nДамир");
    expect(signedIn(localDate(22, 59))).toBe("Добрый вечер,\nДамир");
    expect(signedIn(localDate(23, 0))).toBe("Доброй ночи,\nДамир");
  });

  /**
   * Форма строки (макет 3102:11996, правка владельца 2026-08-26). Проверяется
   * отдельно от текста: запятая и перенос — это НЕ украшение, а две строки
   * шапки, под которые сверстана её высота.
   */
  it("между приветствием и именем ровно «запятая + перенос», и перенос один", () => {
    const text = signedIn(localDate(9, 0), "Камила");
    const [first, second, ...rest] = text.split("\n");
    expect(first).toBe("Доброе утро,");
    expect(second).toBe("Камила");
    // Третьей строки быть не может: `numberOfLines={2}` в шапке обрезал бы её.
    expect(rest).toEqual([]);
    // Пробела перед именем нет — перенос его заменяет, иначе вторая строка
    // начиналась бы с отступа.
    expect(text).not.toContain(", ");
  });

  it("имя из нескольких слов остаётся на своей строке целиком", () => {
    expect(signedIn(localDate(9, 0), "Камила-Айгерим")).toBe("Доброе утро,\nКамила-Айгерим");
  });

  it("вошедший без загруженного имени — приветствие без запятой и хвоста", () => {
    expect(
      homeGreeting({
        authStatus: "signed-in",
        firstName: undefined,
        part: "morning",
        strings: ru.explore.greetings,
      }),
    ).toBe("Доброе утро");
    // Пустое/пробельное имя ведёт себя так же, а не «Доброе утро,  ».
    expect(
      homeGreeting({
        authStatus: "signed-in",
        firstName: "   ",
        part: "evening",
        strings: ru.explore.greetings,
      }),
    ).toBe("Добрый вечер");
  });

  it("пока сессия не прочитана, не врёт ни гостю, ни вошедшему", () => {
    // «Добро пожаловать» мигнуло бы вошедшему неправдой, имя показывать нечего
    // — остаётся нейтральное приветствие по времени.
    expect(
      homeGreeting({
        authStatus: "loading",
        firstName: undefined,
        part: "afternoon",
        strings: ru.explore.greetings,
      }),
    ).toBe("Добрый день");
  });

  it("строки переведены в en и kk, каждая на своём языке", () => {
    const cases = [
      ["morning", "Good morning", "Қайырлы таң"],
      ["afternoon", "Good afternoon", "Қайырлы күн"],
      ["evening", "Good evening", "Қайырлы кеш"],
      ["night", "Good night", "Қайырлы түн"],
    ] as const;
    for (const [part, english, kazakh] of cases) {
      expect(homeGreeting({ authStatus: "signed-in", part, strings: en.explore.greetings })).toBe(
        english,
      );
      expect(homeGreeting({ authStatus: "signed-in", part, strings: kk.explore.greetings })).toBe(
        kazakh,
      );
    }
    expect(
      homeGreeting({ authStatus: "signed-out", part: "morning", strings: en.explore.greetings }),
    ).toBe("Welcome");
    expect(
      homeGreeting({ authStatus: "signed-out", part: "morning", strings: kk.explore.greetings }),
    ).toBe("Қош келдіңіз");
    expect(
      homeGreeting({
        authStatus: "signed-in",
        firstName: "Damir",
        part: "evening",
        strings: en.explore.greetings,
      }),
    ).toBe("Good evening,\nDamir");
  });
});

/**
 * Возврат в приложение. Приветствие, посчитанное один раз при запуске,
 * залипает: свернул вечером, открыл утром — читаешь «Добрый вечер».
 */
describe("usePartOfDay — пересчёт при возврате в приложение", () => {
  const listeners: ((state: string) => void)[] = [];

  afterEach(() => {
    listeners.length = 0;
    vi.restoreAllMocks();
  });

  function Probe({ clock }: { clock: () => Date }) {
    const part = usePartOfDay(clock);
    return <span data-testid="part">{part}</span>;
  }

  it("меняет часть суток, когда приложение снова становится активным", async () => {
    const rn = await import("react-native");
    vi.spyOn(rn.AppState, "addEventListener").mockImplementation(((
      _type: string,
      handler: (state: string) => void,
    ) => {
      listeners.push(handler);
      return { remove: () => listeners.splice(listeners.indexOf(handler), 1) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    let now = localDate(20, 0);
    const clock = () => now;
    render(<Probe clock={clock} />);
    expect(screen.getByTestId("part").textContent).toBe("evening");

    // Ушли в фон, вернулись следующим утром.
    now = localDate(8, 0);
    act(() => {
      listeners.forEach((handler) => handler("background"));
    });
    expect(screen.getByTestId("part").textContent).toBe("evening");

    act(() => {
      listeners.forEach((handler) => handler("active"));
    });
    expect(screen.getByTestId("part").textContent).toBe("morning");
  });

  it("отписывается при размонтировании", async () => {
    const rn = await import("react-native");
    vi.spyOn(rn.AppState, "addEventListener").mockImplementation(((
      _type: string,
      handler: (state: string) => void,
    ) => {
      listeners.push(handler);
      return { remove: () => listeners.splice(listeners.indexOf(handler), 1) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const { unmount } = render(<Probe clock={() => localDate(9, 0)} />);
    expect(listeners).toHaveLength(1);
    unmount();
    expect(listeners).toHaveLength(0);
  });
});
