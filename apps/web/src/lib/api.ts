import {
  HttpAuthRepository,
  HttpRestaurantRepository,
  type AuthRepository,
  type RestaurantRepository,
} from "@bookeat/api/client";

import { browserStorage, readAccessToken } from "@web/lib/session-store";

/**
 * Единственная точка, где веб получает доступ к данным.
 *
 * ПОЧЕМУ НЕ `createRestaurantRepository`, которым пользуются мобилка и
 * кабинет: эта фабрика при пустом адресе МОЛЧА отдаёт мок-репозиторий с
 * вшитыми заведениями. На телефоне это осознанный режим «работает без
 * бэкенда», а на публичном сайте — витрина с выдуманными ресторанами, которую
 * никто не заметит до первого звонка гостя. Поэтому здесь ровно одна
 * реализация — HTTP, а отсутствие адреса это состояние ошибки (см.
 * `isApiConfigured` и `states.notConfigured*` в словаре), а не другой источник
 * данных.
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();

/** false — в сборке не задан NEXT_PUBLIC_API_URL. Экраны показывают этим
 * отдельное состояние вместо бесконечной загрузки. */
export const isApiConfigured = API_URL.length > 0;

/**
 * Язык, который уходит в `Accept-Language`. Живёт модульной ячейкой, а не
 * пропсом: репозиторий создаётся один раз, а язык гость меняет на ходу —
 * замыкание читает актуальное значение на каждом запросе. Ключи запросов
 * TanStack Query включают локаль, поэтому смена языка перезапрашивает данные,
 * а не показывает старый перевод из кэша.
 */
let currentLanguage = "ru";

export function setApiLanguage(language: string): void {
  currentLanguage = language;
}

/**
 * Обработчик 401 на защищённом запросе. Ставится ОДИН раз при создании
 * провайдера сессии (`lib/auth.tsx`): репозитории собираются на уровне модуля,
 * а обновление токена умеет только он, потому что только он знает про
 * состояние React.
 *
 * Модульная ячейка, а не параметр конструктора, по той же причине, что и язык:
 * репозиторий создаётся один раз, а обработчик появляется позже.
 */
let onUnauthorized: ((staleToken: string) => Promise<string | undefined>) | null = null;

export function setUnauthorizedHandler(
  handler: ((staleToken: string) => Promise<string | undefined>) | null,
): void {
  onUnauthorized = handler;
}

/** Токен для защищённых запросов. Читается из хранилища на КАЖДОМ запросе:
 * гость может войти или выйти в соседней вкладке. */
function currentToken(): string | undefined {
  return readAccessToken(browserStorage()) ?? undefined;
}

/** Репозиторий один на вкладку: у него нет состояния, кроме базового адреса. */
export const repository: RestaurantRepository = new HttpRestaurantRepository({
  baseUrl: API_URL,
  getLanguage: () => currentLanguage,
  getToken: currentToken,
  onUnauthorized: (stale) => (onUnauthorized ? onUnauthorized(stale) : Promise.resolve(undefined)),
});

/**
 * Вход и профиль. Отдельный репозиторий, потому что в `@bookeat/api` это
 * отдельный интерфейс: у каталога и у авторизации разные ручки и разные
 * дедлайны (запрос кода ждёт 20 секунд — сервер шлёт код синхронно).
 */
export const authRepository: AuthRepository = new HttpAuthRepository({
  baseUrl: API_URL,
  getLanguage: () => currentLanguage,
  getToken: currentToken,
  onUnauthorized: (stale) => (onUnauthorized ? onUnauthorized(stale) : Promise.resolve(undefined)),
});
