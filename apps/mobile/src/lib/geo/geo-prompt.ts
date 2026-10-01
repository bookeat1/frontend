import * as SecureStore from "../secure-store";

/**
 * Что помним про карточку «Показать сначала ближайшие?» (спека
 * geolocation-permission.md, раздел 5 «Мобильный, на диске»).
 *
 * НА ДИСКЕ ТОЛЬКО ЭТИ ДВА ФЛАГА. Координат здесь нет и быть не может: это
 * проверяется тестом. Хранилище то же, что у `preferred-city.ts` и
 * `foodie-invite-snooze.ts` — `expo-secure-store`.
 *
 * Ошибка хранилища и мусор в нём читаются как «карточку ещё не видели»: цена
 * ошибки в эту сторону — один лишний показ, а не спрятанная навсегда фича.
 */

export const GEO_PROMPT_ANSWERED_KEY = "bookeat.geo.prompt.answered.v1";
export const GEO_PROMPT_AUTO_SHOWS_KEY = "bookeat.geo.prompt.autoShows.v1";

/** Сколько раз карточка показывается сама, без единого тапа, прежде чем замолчать (3.3). */
export const GEO_PROMPT_MAX_AUTO_SHOWS = 3;

export interface GeoPromptFlags {
  /** Гость тапнул любую кнопку карточки. */
  answered: boolean;
  /** Сколько раз карточка уже показывалась, 0..3. */
  autoShows: number;
}

export async function readGeoPromptFlags(): Promise<GeoPromptFlags> {
  try {
    const [answered, shows] = await Promise.all([
      SecureStore.getItemAsync(GEO_PROMPT_ANSWERED_KEY),
      SecureStore.getItemAsync(GEO_PROMPT_AUTO_SHOWS_KEY),
    ]);
    const parsed = Number(shows);
    return {
      answered: answered === "1",
      autoShows:
        Number.isInteger(parsed) && parsed >= 0
          ? Math.min(parsed, GEO_PROMPT_MAX_AUTO_SHOWS)
          : 0,
    };
  } catch {
    return { answered: false, autoShows: 0 };
  }
}

/** Гость ответил на карточку (любая кнопка): больше сама не появится. */
export async function markGeoPromptAnswered(): Promise<void> {
  try {
    await SecureStore.setItemAsync(GEO_PROMPT_ANSWERED_KEY, "1");
  } catch {
    // Хранилище недоступно — карточка вернётся после перезапуска, не страшно.
  }
}

/** Карточка показана ещё раз. */
export async function recordGeoPromptShown(previous: number): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      GEO_PROMPT_AUTO_SHOWS_KEY,
      String(Math.min(previous + 1, GEO_PROMPT_MAX_AUTO_SHOWS)),
    );
  } catch {
    // см. выше
  }
}
