import type { AuthSession, AuthUser } from "@bookeat/api/client";

/**
 * Единственное место, которое читает и пишет сессию гостя на сайте.
 *
 * ГДЕ ХРАНИМ И ЧЕМ ЭТО ПЛОХО. `localStorage`, как в кабинете
 * (`apps/admin/src/lib/token-store.ts`). Честный минус: значение доступно
 * любому скрипту на странице, то есть XSS уносит сессию. Правильнее была бы
 * httpOnly-кука, но её обязан ставить СЕРВЕР, а токены сайту выдаёт чужой
 * бэкенд напрямую из браузера — своей серверной ручки, которая переложила бы
 * их в куку, у сайта сегодня нет. Заводить её ради экрана входа, за которым
 * пока нет ни одной защищённой страницы, — это отдельная задача, и она честнее
 * выглядит рядом с бронированием, чем спрятанной в правку вёрстки.
 *
 * `sessionStorage` не подошёл: гость, вернувшийся на сайт назавтра, не должен
 * входить заново, а refresh-токен живёт 30 дней.
 */

const KEYS = {
  accessToken: "bookeat.web.access_token",
  refreshToken: "bookeat.web.refresh_token",
  /** RFC3339 из ответа сервера. Нужен, чтобы обновлять токен ДО 401, а не
   * после него. */
  expiresAt: "bookeat.web.access_expires_at",
  user: "bookeat.web.user",
} as const;

/** Ровно та часть `Storage`, которая нужна, — чтобы тест мог подсунуть
 * обычный объект вместо jsdom. */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage браузера, или null на сервере и там, где он запрещён
 * (Safari в приватном режиме на обращении БРОСАЕТ, а не отдаёт null). */
export function browserStorage(): SessionStorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAccessToken(storage: SessionStorageLike | null): string | null {
  return storage?.getItem(KEYS.accessToken) ?? null;
}

export function readRefreshToken(storage: SessionStorageLike | null): string | null {
  return storage?.getItem(KEYS.refreshToken) ?? null;
}

/** Когда умирает текущий access-токен, в epoch ms, или null, если это
 * неизвестно. Null — не ошибка: теряется только упреждающее обновление. */
export function readAccessExpiry(storage: SessionStorageLike | null): number | null {
  const stored = storage?.getItem(KEYS.expiresAt);
  if (!stored) return null;
  const parsed = Date.parse(stored);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Профиль, сохранённый при входе. Показывается в шапке сразу после
 * перезагрузки, не дожидаясь ответа `GET /users/me`. Мусор в хранилище
 * читается как «нет профиля», а не роняет страницу. */
export function readUser(storage: SessionStorageLike | null): AuthUser | null {
  const raw = storage?.getItem(KEYS.user);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const user = parsed as Partial<AuthUser>;
    return typeof user.id === "string" ? (user as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Пара токенов из входа или из обновления. Пишется вместе, чтобы никакой
 * читатель не увидел новый access рядом со старым refresh. */
export function storeSession(storage: SessionStorageLike | null, session: AuthSession): void {
  if (!storage) return;
  storage.setItem(KEYS.accessToken, session.accessToken);
  storage.setItem(KEYS.refreshToken, session.refreshToken);
  if (session.expiresAt) storage.setItem(KEYS.expiresAt, session.expiresAt);
  else storage.removeItem(KEYS.expiresAt);
}

export function storeUser(storage: SessionStorageLike | null, user: AuthUser): void {
  storage?.setItem(KEYS.user, JSON.stringify(user));
}

/** Стереть всё, что относится к сессии. Выход и невосстановимый 401. */
export function clearSession(storage: SessionStorageLike | null): void {
  if (!storage) return;
  for (const key of Object.values(KEYS)) storage.removeItem(key);
}
