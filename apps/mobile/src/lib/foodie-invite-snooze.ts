import * as SecureStore from "./secure-store";

/**
 * «Крестик» на карточке-приглашении «Расскажите, что любите» (персонализация
 * v1, `specs/foodie-personalization-v1-20260916.md`, сценарий 3.2, состояния
 * 5.8, критерий 22). Тот же приём, что у отказа от обновления
 * (`./update-snooze.ts`) — запись ПЕРЕЖИВАЕТ перезапуск, — но с двумя
 * дополнительными штуками, которых у «Позже» нет:
 *
 *  - СЧЁТЧИК до снуза, а не немедленный снуз на первом же тапе — 5.8: «shown
 *    → dismissed(n) → при n=3 snoozed_until (+30 дней) → shown». Три
 *    закрытия подряд — это «мне сейчас неудобно», а не «никогда не
 *    показывайте», поэтому снуз (30 дней) наступает не сразу.
 *  - `hiddenForever` — НЕОБРАТИМЫЙ флаг: как только профиль гостя перестал
 *    быть пустым (любым способом, не обязательно через эту карточку —
 *    например, визард открыли из «Профиля»), приглашение больше не имеет
 *    смысла вовсе и не должно всплывать снова, даже если 30-дневный снуз к
 *    этому моменту истёк.
 */

export const FOODIE_INVITE_SNOOZE_KEY = "bookeat.foodieInvite.dismiss.v1";

/** Сутки×30 — тот же порядок величины, что и у «отказа от обновления», но
 * длиннее: карточка не блокирует ничего критического, три закрытия подряд
 * достаточно ясно говорят «не сейчас», и ежедневная переспросов надоела бы. */
export const FOODIE_INVITE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/** Сколько закрытий подряд до 30-дневного молчания (5.8). */
export const FOODIE_INVITE_DISMISS_LIMIT = 3;

export interface FoodieInviteState {
  /** Закрытий с последнего снуза (или с начала), 0..DISMISS_LIMIT-1. */
  dismissals: number;
  /** Unix-время в миллисекундах, до которого молчим, или `null`. */
  snoozedUntil: number | null;
  /** Профиль гостя перестал быть пустым — приглашение больше не покажется
   * никогда, независимо от `dismissals`/`snoozedUntil`. */
  hiddenForever: boolean;
}

export const EMPTY_FOODIE_INVITE_STATE: FoodieInviteState = {
  dismissals: 0,
  snoozedUntil: null,
  hiddenForever: false,
};

/** Те же три вызова хранилища, что у `update-snooze.ts` — чтобы тест давал
 * своё хранилище, а не мокал нативный модуль. */
export interface FoodieInviteStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

/**
 * Строка из хранилища → состояние, или ИСХОДНОЕ («карточка ещё ни разу не
 * закрывалась»). Любой мусор (не JSON, чужая форма, числа не числами) —
 * тоже исходное состояние: ошибка в эту сторону стоит гостю одного лишнего
 * показа карточки, ошибка в обратную — спрятанного навсегда приглашения.
 */
export function parseFoodieInviteState(raw: string | null): FoodieInviteState {
  if (!raw) return EMPTY_FOODIE_INVITE_STATE;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_FOODIE_INVITE_STATE;
  }
  if (typeof value !== "object" || value === null) return EMPTY_FOODIE_INVITE_STATE;
  const record = value as Record<string, unknown>;
  const dismissals = record.dismissals;
  const snoozedUntil = record.snoozedUntil;
  const hiddenForever = record.hiddenForever;
  if (typeof dismissals !== "number" || !Number.isFinite(dismissals)) {
    return EMPTY_FOODIE_INVITE_STATE;
  }
  if (snoozedUntil !== null && (typeof snoozedUntil !== "number" || !Number.isFinite(snoozedUntil))) {
    return EMPTY_FOODIE_INVITE_STATE;
  }
  if (typeof hiddenForever !== "boolean") return EMPTY_FOODIE_INVITE_STATE;
  return { dismissals, snoozedUntil: snoozedUntil ?? null, hiddenForever };
}

/** Разрешено ли показывать карточку ПРЯМО СЕЙЧАС, судя по записанному
 * состоянию (без учёта того, пуст ли профиль — это отдельная проверка). */
export function foodieInviteAllowed(state: FoodieInviteState, now: number): boolean {
  if (state.hiddenForever) return false;
  if (state.snoozedUntil !== null && now < state.snoozedUntil) return false;
  return true;
}

/** Прочитать состояние. Недоступное хранилище — «карточка ещё не
 * закрывалась», а не падение (тот же принцип, что у `readUpdateSnooze`). */
export async function readFoodieInviteState(
  storage: FoodieInviteStorage = SecureStore,
): Promise<FoodieInviteState> {
  try {
    return parseFoodieInviteState(await storage.getItemAsync(FOODIE_INVITE_SNOOZE_KEY));
  } catch {
    return EMPTY_FOODIE_INVITE_STATE;
  }
}

/**
 * Записывает ОДНО закрытие крестиком. Если это ТРЕТЬЕ подряд — переходит в
 * 30-дневный снуз и сбрасывает счётчик (следующий показ, через 30 дней,
 * снова начинает отсчёт с нуля — 5.8: «→ shown» после снуза, цикл
 * повторяется). Неудачная запись стоит только долговечности отказа, не
 * самого закрытия — та часть держится в памяти компонента.
 */
export async function writeFoodieInviteDismiss(
  current: FoodieInviteState,
  now: number,
  storage: FoodieInviteStorage = SecureStore,
): Promise<FoodieInviteState> {
  const dismissals = current.dismissals + 1;
  const next: FoodieInviteState =
    dismissals >= FOODIE_INVITE_DISMISS_LIMIT
      ? { dismissals: 0, snoozedUntil: now + FOODIE_INVITE_SNOOZE_MS, hiddenForever: false }
      : { dismissals, snoozedUntil: null, hiddenForever: false };
  try {
    await storage.setItemAsync(FOODIE_INVITE_SNOOZE_KEY, JSON.stringify(next));
  } catch {
    // Хранилище недоступно — отказ живёт только до конца сессии (в памяти
    // компонента), не дольше.
  }
  return next;
}

/**
 * Профиль гостя перестал быть пустым — навсегда гасит приглашение (5.8).
 * Вызывается на КАЖДЫЙ успешный ответ `GET /users/me/foodie-profile`, не
 * только пока карточка видна: гость мог заполнить профиль из «Профиля»,
 * минуя эту карточку вовсе.
 */
export async function writeFoodieInviteHiddenForever(
  storage: FoodieInviteStorage = SecureStore,
): Promise<FoodieInviteState> {
  const next: FoodieInviteState = { dismissals: 0, snoozedUntil: null, hiddenForever: true };
  try {
    await storage.setItemAsync(FOODIE_INVITE_SNOOZE_KEY, JSON.stringify(next));
  } catch {
    // См. writeFoodieInviteDismiss — то же самое смирение с недоступным
    // хранилищем.
  }
  return next;
}
