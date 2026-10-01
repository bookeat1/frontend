import type { GeoPoint } from "@bookeat/api";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { hasLocationModule, importLocation, type LocationModule } from "./location-native";

/**
 * Геопозиция гостя, один провайдер на приложение (спека
 * geolocation-permission.md, M2, раздел 5 «Мобильный, в памяти»).
 *
 * ЖЁСТКИЕ ПРАВИЛА (каждое проверяется тестом):
 *  - Только FOREGROUND. Никаких `watchPositionAsync`, фоновых запросов позиции
 *    и геофенсинга: позиция берётся по требованию, одним снимком.
 *  - Системный диалог вызывается ТОЛЬКО из `request()`, а `request()` зовут
 *    только обработчик «Разрешить» в карточке и тап по строке настроек. Чтение
 *    статуса при старте и по `AppState` диалога не вызывает.
 *  - Координаты живут ТОЛЬКО в памяти процесса (`pointRef`): ни диска, ни
 *    react-query-кэша, ни логов, ни аналитики. Живут не дольше 10 минут.
 *  - Нет нативного модуля (старый бинарь с новым JS) или веб → `unsupported`,
 *    и всё остальное приложение работает как раньше.
 */

/** Сколько позиция считается свежей и берётся из памяти без нового запроса. */
export const LOCATION_TTL_MS = 10 * 60 * 1000;
/** Сколько ждём `getCurrentPositionAsync`, прежде чем сдаться. */
export const LOCATION_TIMEOUT_MS = 8000;
/** «Последняя известная позиция» годится, если не старше 10 минут и точнее 5 км. */
const LAST_KNOWN = { maxAge: LOCATION_TTL_MS, requiredAccuracy: 5000 } as const;

export type GeoPermission =
  /** Статус ещё читается (первые миллисекунды после старта). */
  | "pending"
  /** Веб или бинарь без нативного модуля — терминальное состояние. */
  | "unsupported"
  | "undetermined"
  | "granted"
  | "denied";

/** Чем кончился запрос разрешения. Имена совпадают с `result` события аналитики. */
export type RequestOutcome =
  | { result: "granted"; precise: boolean | null; point: GeoPoint | null }
  | { result: "denied"; precise: null; point: null }
  | { result: "unavailable"; precise: null; point: null };

export interface GuestLocation {
  permission: GeoPermission;
  /** Можно ли ещё показать системный диалог (iOS после отказа: нельзя). */
  canAskAgain: boolean;
  /** Разрешение есть, но геолокация на самом телефоне выключена (или позицию не получили). */
  servicesOff: boolean;
  /** Точная или приблизительная; `null` — не знаем. */
  precise: boolean | null;
  /** Свежая позиция из памяти или `null`. Синхронно, ничего не запрашивает. */
  peekFresh: () => GeoPoint | null;
  /** Позиция: из памяти, иначе last-known → current (таймаут 8 с). Никогда не бросает. */
  locate: () => Promise<GeoPoint | null>;
  /** Системный диалог. Единственное место, где он вызывается. */
  request: () => Promise<RequestOutcome>;
  /** Перечитать статус ОС (без диалога). */
  refresh: () => Promise<void>;
}

const UNSUPPORTED: GuestLocation = {
  permission: "unsupported",
  canAskAgain: false,
  servicesOff: false,
  precise: null,
  peekFresh: () => null,
  locate: async () => null,
  request: async () => ({ result: "unavailable", precise: null, point: null }),
  refresh: async () => {},
};

/** Экспортирован ради тестов хуков, которым нужен подставной статус. */
export const GuestLocationContext = createContext<GuestLocation>(UNSUPPORTED);

/** Хук читает провайдера; без провайдера (тесты, веб-экспорт) — `unsupported`. */
export function useGuestLocation(): GuestLocation {
  return useContext(GuestLocationContext);
}

interface PermissionSnapshot {
  permission: Exclude<GeoPermission, "pending" | "unsupported">;
  canAskAgain: boolean;
  precise: boolean | null;
}

function toSnapshot(res: {
  status: string;
  canAskAgain: boolean;
  ios?: { accuracy?: string };
  android?: { accuracy?: string };
}): PermissionSnapshot {
  const permission =
    res.status === "granted" ? "granted" : res.status === "denied" ? "denied" : "undetermined";
  let precise: boolean | null = null;
  if (permission === "granted") {
    if (res.ios?.accuracy) precise = res.ios.accuracy === "full";
    else if (res.android?.accuracy && res.android.accuracy !== "none") {
      precise = res.android.accuracy === "fine";
    }
  }
  return { permission, canAskAgain: res.canAskAgain, precise };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("location timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function GuestLocationProvider({ children }: { children: React.ReactNode }) {
  // Один раз за жизнь провайдера: бинарь не меняется на лету.
  const [supported] = useState(() => Platform.OS !== "web" && hasLocationModule());
  const [snapshot, setSnapshot] = useState<PermissionSnapshot | null>(null);
  const [servicesOff, setServicesOff] = useState(false);

  // Позиция — ТОЛЬКО здесь, в ref: не в state (перерисовывать нечего), не на
  // диск и не в кэш запросов.
  const pointRef = useRef<{ point: GeoPoint; at: number } | null>(null);
  const inFlight = useRef<Promise<GeoPoint | null> | null>(null);
  const moduleRef = useRef<Promise<LocationModule | null> | null>(null);
  const permissionRef = useRef<PermissionSnapshot["permission"] | null>(null);

  const load = useCallback((): Promise<LocationModule | null> => {
    if (!moduleRef.current) {
      try {
        moduleRef.current = importLocation().then(
          (m) => m,
          () => null,
        );
      } catch {
        // Нативный `import()` бросает синхронно — см. location-native.ts.
        moduleRef.current = Promise.resolve(null);
      }
    }
    return moduleRef.current;
  }, []);

  const apply = useCallback((next: PermissionSnapshot) => {
    permissionRef.current = next.permission;
    if (next.permission !== "granted") {
      // Разрешение отозвали: чужие координаты больше не используем.
      pointRef.current = null;
      setServicesOff(false);
    }
    setSnapshot(next);
  }, []);

  const peekFresh = useCallback((): GeoPoint | null => {
    const entry = pointRef.current;
    if (!entry) return null;
    if (Date.now() - entry.at > LOCATION_TTL_MS) {
      pointRef.current = null;
      return null;
    }
    return entry.point;
  }, []);

  const locate = useCallback((): Promise<GeoPoint | null> => {
    if (!supported || permissionRef.current !== "granted") return Promise.resolve(null);
    const fresh = peekFresh();
    if (fresh) return Promise.resolve(fresh);
    if (inFlight.current) return inFlight.current;

    const run = (async (): Promise<GeoPoint | null> => {
      try {
        const location = await load();
        if (!location) return null;
        let position = await location.getLastKnownPositionAsync({ ...LAST_KNOWN });
        if (!position) {
          position = await withTimeout(
            location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced }),
            LOCATION_TIMEOUT_MS,
          );
        }
        // Права могли отозвать, пока ждали ответ: тогда ответ выбрасываем.
        if (permissionRef.current !== "granted") return null;
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        pointRef.current = { point, at: Date.now() };
        setServicesOff(false);
        return point;
      } catch {
        // Таймаут, геолокация выключена, ошибка нативного слоя: тихо «без
        // координат». Отличаем только «выключена на телефоне» для подсказки.
        try {
          const location = await load();
          const enabled = location ? await location.hasServicesEnabledAsync() : true;
          setServicesOff(!enabled);
        } catch {
          // Подсказка необязательна.
        }
        return null;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [supported, load, peekFresh]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!supported) return;
    try {
      const location = await load();
      if (!location) return;
      const next = toSnapshot(await location.getForegroundPermissionsAsync());
      apply(next);
      if (next.permission === "granted") {
        // Разрешение есть, а геолокацию на телефоне могли выключить (3.7).
        setServicesOff(!(await location.hasServicesEnabledAsync()));
      }
    } catch {
      // Не смогли прочитать — оставляем прежнее значение.
    }
  }, [supported, load, apply]);

  const request = useCallback(async (): Promise<RequestOutcome> => {
    if (!supported) return { result: "unavailable", precise: null, point: null };
    try {
      const location = await load();
      if (!location) return { result: "unavailable", precise: null, point: null };
      const next = toSnapshot(await location.requestForegroundPermissionsAsync());
      apply(next);
      // Диалог закрыли, не ответив (бывает на Android): ответа нет, не выдаём за отказ.
      if (next.permission === "undetermined") {
        return { result: "unavailable", precise: null, point: null };
      }
      if (next.permission !== "granted") return { result: "denied", precise: null, point: null };
      const point = await locate();
      return { result: "granted", precise: next.precise, point };
    } catch {
      return { result: "unavailable", precise: null, point: null };
    }
  }, [supported, load, apply, locate]);

  // Старт: ЧИТАЕМ статус (диалога это не вызывает).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Вернулись из фона: статус мог поменяться в системных настройках (3.9).
  useEffect(() => {
    if (!supported) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [supported, refresh]);

  const value = useMemo<GuestLocation>(() => {
    if (!supported) return UNSUPPORTED;
    return {
      permission: snapshot ? snapshot.permission : "pending",
      canAskAgain: snapshot?.canAskAgain ?? false,
      servicesOff,
      precise: snapshot?.precise ?? null,
      peekFresh,
      locate,
      request,
      refresh,
    };
  }, [supported, snapshot, servicesOff, peekFresh, locate, request, refresh]);

  return <GuestLocationContext.Provider value={value}>{children}</GuestLocationContext.Provider>;
}
