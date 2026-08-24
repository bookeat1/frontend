import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Приветствие в шапке главной (правка владельца 2026-08-24).
 *
 * Два разных случая, а не один с подстановкой имени:
 *   • гость, не вошедший в аккаунт — «Добро пожаловать» (имени у нас нет и
 *     взяться ему неоткуда);
 *   • вошедший — приветствие по времени суток НА ЕГО УСТРОЙСТВЕ с именем
 *     рядом: «Доброе утро, Дамир».
 *
 * Время берётся с устройства (`Date#getHours`), а не с сервера и не по
 * фиксированному поясу заведения: человеку важно, что сейчас у НЕГО. Часовой
 * пояс подставляет система, отдельного пересчёта здесь нет.
 */
export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

/**
 * Границы суток в МЕСТНЫХ часах устройства — единственное место, где они
 * записаны. Каждое поле — час, с которого начинается соответствующая часть
 * суток; ночь начинается с `nightStartsAt` и длится до `morningStartsAt`
 * следующих суток.
 *
 * Сегодня: 05:00–11:59 утро, 12:00–17:59 день, 18:00–22:59 вечер,
 * 23:00–04:59 ночь. Поменять раскладку = поменять эти четыре числа.
 */
export const GREETING_HOURS = {
  morningStartsAt: 5,
  afternoonStartsAt: 12,
  eveningStartsAt: 18,
  nightStartsAt: 23,
} as const;

/** Часть суток для момента `at` по местному времени устройства. */
export function partOfDay(at: Date): PartOfDay {
  const hour = at.getHours();
  // Ночь проверяется первой: это единственный интервал, который переходит
  // через полночь, поэтому его нельзя выразить одним «меньше чем».
  if (hour >= GREETING_HOURS.nightStartsAt || hour < GREETING_HOURS.morningStartsAt) {
    return "night";
  }
  if (hour < GREETING_HOURS.afternoonStartsAt) return "morning";
  if (hour < GREETING_HOURS.eveningStartsAt) return "afternoon";
  return "evening";
}

/** Набор строк приветствия из словаря (`t.explore.greetings`). */
export interface GreetingStrings {
  welcome: string;
  morning: string;
  afternoon: string;
  evening: string;
  night: string;
  withName: (greeting: string, name: string) => string;
}

/**
 * Готовая строка приветствия для шапки.
 *
 * `authStatus === "loading"` — сессия ещё не прочитана, и мы НЕ знаем, гость
 * это или вошедший. Показываем приветствие по времени без имени: оно верно в
 * обоих случаях, тогда как «Добро пожаловать» мигнуло бы вошедшему ложью.
 */
export function homeGreeting({
  authStatus,
  firstName,
  part,
  strings,
}: {
  authStatus: "loading" | "signed-out" | "signed-in";
  firstName?: string;
  part: PartOfDay;
  strings: GreetingStrings;
}): string {
  if (authStatus === "signed-out") return strings.welcome;
  const byTime = strings[part];
  const name = firstName?.trim();
  return name ? strings.withName(byTime, name) : byTime;
}

const systemNow = () => new Date();

/**
 * Часть суток, пересчитанная при КАЖДОМ возврате в приложение.
 *
 * Иначе приветствие залипает на том, что было при запуске: человек открыл
 * вечером, свернул, открыл утром — и читает «Добрый вечер». Своего приёма
 * ловли возврата в проекте не было (`AppState` до этой правки не
 * использовался нигде), поэтому подписка на `AppState` стандартная и живёт
 * здесь, рядом с логикой, которая от неё зависит.
 *
 * `now` — только для тестов; по умолчанию системные часы устройства.
 */
export function usePartOfDay(now: () => Date = systemNow): PartOfDay {
  const read = useCallback(() => partOfDay(now()), [now]);
  const [part, setPart] = useState<PartOfDay>(read);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") setPart(read());
    });
    // Приложение могло провести в фоне достаточно, чтобы часть суток
    // сменилась ещё до подписки.
    setPart(read());
    return () => subscription.remove();
  }, [read]);

  return part;
}
