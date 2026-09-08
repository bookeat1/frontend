"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RepositoryError, type AuthSession, type AuthUser } from "@bookeat/api/client";
import { useQueryClient } from "@tanstack/react-query";

import { authRepository, setUnauthorizedHandler } from "@web/lib/api";
import { clearAllBookingFormDrafts } from "@web/lib/booking-form-draft";
import { forgetSessionScopedQueries } from "@web/lib/query-keys";
import {
  browserStorage,
  clearSession,
  readAccessToken,
  readRefreshToken,
  readUser,
  storeSession,
  storeUser,
} from "@web/lib/session-store";

/**
 * Сессия гостя на сайте.
 *
 * Что она делает и чего НЕ делает.
 *
 * ДЕЛАЕТ: держит токены и профиль, отдаёт их шапке, обновляет пару по
 * refresh-токену, когда сервер ответил 401, и разлогинивает, если сервер
 * отказал окончательно.
 *
 * НЕ ДЕЛАЕТ: не сторожит маршруты. Защищённых страниц на сайте сегодня нет
 * вообще — вход нужен как вход, а не как пропуск куда-то. Первый же экран,
 * которому потребуется токен (бронь, избранное, «мои брони»), допишет сюда
 * проверку; выдумывать её заранее значит выдумывать и правила редиректа.
 *
 * ОДНА ЛОВУШКА БЭКЕНДА, которую нельзя игнорировать: refresh-токен ОДНОРАЗОВЫЙ
 * и после обмена сразу отзывается (проверено на кабинете, см.
 * `apps/admin/src/lib/session.ts`). Значит два параллельных обновления —
 * это выход из аккаунта: второе предъявит уже отозванный токен. Поэтому здесь
 * единый «полёт» на вкладку (`inFlight`) и межвкладочный замок Web Locks с
 * ПЕРЕЧИТЫВАНИЕМ хранилища внутри замка: тот, кто ждал, находит свежий токен
 * и никуда не ходит.
 *
 * И вторая: отказ сервера и обрыв связи — разные вещи. Сессию завершает
 * ТОЛЬКО отказ (400/401/422). Разлогинивать гостя из-за моргнувшего Wi-Fi
 * было бы багом хуже исходного.
 */

const REFRESH_LOCK = "bookeat.web.token-refresh";

export interface AuthContextValue {
  user: AuthUser | null;
  /** Сессия из хранилища ещё не прочитана. До этого момента шапка не должна
   * мигать кнопкой «Войти» тому, кто уже вошёл. */
  isLoading: boolean;
  signedIn: boolean;
  /** Записать сессию после успешного `verifyOtp` и подтянуть профиль. */
  completeSignIn(session: AuthSession): Promise<void>;
  /** Профиль изменили (настройки): положить свежий ответ `PATCH /users/me`
   * в хранилище и в состояние, чтобы шапка и карточка гостя не отстали. */
  applyUser(user: AuthUser): void;
  signOut(): void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signedIn: false,
  completeSignIn: async () => {},
  applyUser: () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [isLoading, setLoading] = useState(true);
  /** `AuthProvider` стоит ВНУТРИ `QueryClientProvider` (см. app/providers.tsx),
   * поэтому кэш ему доступен — и смена сессии его чистит. */
  const queryClient = useQueryClient();
  /** Единый «полёт» обновления внутри вкладки. */
  const inFlight = useRef<Promise<string | undefined> | null>(null);

  const forget = useCallback(() => {
    clearSession(browserStorage());
    setUser(null);
    setSignedIn(false);
    // Данные прежней сессии не должны пережить её. Иначе после отзыва токена
    // гость продолжает видеть закрашенные сердца прежнего пользователя, а
    // следующий вошедший в этой же вкладке — его избранное, и первый же клик
    // уходит на сервер уже от СВОЕГО имени.
    forgetSessionScopedQueries(queryClient);
    // Черновик формы брони (имя, телефон, e-mail) — тоже данные прежнего
    // гостя, и он сильнее профиля следующего: см. `clearAllBookingFormDrafts`.
    clearAllBookingFormDrafts();
  }, [queryClient]);

  const refresh = useCallback(
    async (staleToken: string): Promise<string | undefined> => {
      const storage = browserStorage();
      // Кто-то уже заменил токен, с которым ушёл наш запрос: повторяем с его,
      // а не отзываем исправный.
      const current = readAccessToken(storage);
      if (current && current !== staleToken) return current;

      const refreshToken = readRefreshToken(storage);
      if (!refreshToken) {
        forget();
        return undefined;
      }

      try {
        const session = await authRepository.refresh(refreshToken);
        storeSession(storage, session);
        return session.accessToken;
      } catch (error) {
        if (isRefusal(error)) {
          forget();
          return undefined;
        }
        // Обрыв связи, а не отказ: сессию оставляем, экран покажет свою ошибку.
        return undefined;
      }
    },
    [forget],
  );

  useEffect(() => {
    setUnauthorizedHandler((staleToken) => {
      if (inFlight.current) return inFlight.current;
      const attempt = withLock(() => refresh(staleToken)).finally(() => {
        inFlight.current = null;
      });
      inFlight.current = attempt;
      return attempt;
    });
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  useEffect(() => {
    // Читаем хранилище ПОСЛЕ гидратации: на сервере его нет, и любая попытка
    // отрисовать «вошёл» в разметке — это расхождение первой отрисовки.
    const storage = browserStorage();
    const token = readAccessToken(storage);
    if (!token) {
      setLoading(false);
      return;
    }
    setUser(readUser(storage));
    setSignedIn(true);
    setLoading(false);

    // Профиль мог измениться (имя правили в приложении), а токен — протухнуть.
    // Сходим за ним; 401 разберёт onUnauthorized, а окончательный отказ уже
    // почистит сессию.
    let cancelled = false;
    void authRepository
      .getMe()
      .then((fresh) => {
        if (cancelled) return;
        storeUser(browserStorage(), fresh);
        setUser(fresh);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isRefusal(error)) forget();
      });
    return () => {
      cancelled = true;
    };
  }, [forget]);

  const completeSignIn = useCallback(
    async (session: AuthSession) => {
      const storage = browserStorage();
      // И на ВХОДЕ тоже: выход мог случиться в другой вкладке, а этот кэш
      // живёт в памяти вкладки и `clearSession` его не касается.
      forgetSessionScopedQueries(queryClient);
      clearAllBookingFormDrafts();
      storeSession(storage, session);
      setSignedIn(true);
      try {
        const fresh = await authRepository.getMe();
        storeUser(browserStorage(), fresh);
        setUser(fresh);
      } catch {
        // Профиль не приехал — вход всё равно состоялся, токены на месте.
        // Шапка покажет обобщённую подпись вместо имени, а не выкинет гостя.
        setUser(null);
      }
    },
    [queryClient],
  );

  const applyUser = useCallback((fresh: AuthUser) => {
    storeUser(browserStorage(), fresh);
    setUser(fresh);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, signedIn, completeSignIn, applyUser, signOut: forget }),
    [user, isLoading, signedIn, completeSignIn, applyUser, forget],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/** Сервер СКАЗАЛ «нет», а не промолчал. Только это заканчивает сессию. */
function isRefusal(error: unknown): boolean {
  return (
    error instanceof RepositoryError &&
    (error.status === 400 || error.status === 401 || error.status === 422)
  );
}

/** Межвкладочный замок. Без Web Locks (старый Safari, не-https) остаётся
 * защита внутри вкладки — теряется только межвкладочная. */
function withLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return run();
  return locks.request(REFRESH_LOCK, run);
}
