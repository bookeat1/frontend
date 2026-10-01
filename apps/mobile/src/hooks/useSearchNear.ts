import type { GeoPoint } from "@bookeat/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGuestLocation } from "../lib/geo/guest-location";
import { useScreenFocusCount } from "../lib/screen-focus";

/** Сколько «Поиск» ждёт позицию, прежде чем уйти первым запросом без неё (3.8). */
export const NEAR_WAIT_MS = 1500;

/**
 * Откуда экран «Поиск» берёт `near` для запроса каталога (спека
 * geolocation-permission.md, сценарии 3.1, 3.8, 3.9, критерии 14, 16, 18).
 *
 * Правила за визит (визит = фокус экрана: первый при монтировании, следующие при
 * возврате с экрана заведения или из системных настроек, спека 3.8):
 *  - статус ещё читается → ждём не дольше {@link NEAR_WAIT_MS}, затем запрос уходит
 *    без координат (провайдер при ошибке чтения сам уходит в `unsupported`);
 *    разрешения нет → `settled`, `near` пуст;
 *  - свежая позиция в памяти (до 10 минут) → берём сразу, запрос уходит с ней;
 *  - иначе ждём не дольше {@link NEAR_WAIT_MS}. Успели → запрос с координатами.
 *    Не успели → первый запрос уходит БЕЗ них и список в этом визите больше не
 *    перестраивается под пальцем: опоздавшая позиция просто остаётся в памяти
 *    провайдера для следующего визита;
 *  - единственное исключение — `applyPoint`: гость только что нажал «Разрешить»,
 *    и перестроить список под его согласием ожидаемо;
 *  - разрешение отозвали (статус стал не `granted`) → `near` сбрасывается.
 */
export function useSearchNear(): {
  near: GeoPoint | undefined;
  /** Можно ли слать первый запрос: решено, с координатами он уйдёт или без. */
  settled: boolean;
  applyPoint: (point: GeoPoint) => void;
} {
  const geo = useGuestLocation();
  const [near, setNear] = useState<GeoPoint | undefined>();
  const [settled, setSettled] = useState(geo.permission === "unsupported");
  const decided = useRef(false);
  // `alive`, а не флаг отмены в эффекте: эффект переживает StrictMode-повтор, а
  // «решили один раз за визит» держится в `decided`.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const { permission, peekFresh, locate } = geo;

  // Новый фокус = новый визит: решение «с координатами или без» принимается
  // заново (координаты, опоздавшие в прошлый раз, или разрешение, выданное в
  // Настройках). `settled` при этом остаётся `true`: каталог уже загружен.
  // Хук фокуса отдаёт 0 до первого фокуса и 1 после него: это один и тот же
  // (первый) визит, поэтому считаем с единицы.
  const focusCount = Math.max(useScreenFocusCount(), 1);
  const lastFocus = useRef(focusCount);
  if (lastFocus.current !== focusCount) {
    lastFocus.current = focusCount;
    decided.current = false;
  }

  // Статус разрешения ещё читается: дольше NEAR_WAIT_MS не ждём (3.8). Первый
  // запрос уходит без координат, а опоздавший статус в этом визите ничего не
  // перестраивает (как и опоздавшая позиция).
  useEffect(() => {
    if (permission !== "pending" || decided.current) return;
    const timer = setTimeout(() => {
      if (decided.current || !alive.current) return;
      decided.current = true;
      setSettled(true);
    }, NEAR_WAIT_MS);
    return () => clearTimeout(timer);
  }, [permission, focusCount]);

  useEffect(() => {
    if (permission === "pending") return;
    if (permission !== "granted") {
      // Нет разрешения или его отозвали (3.9): подпись и координаты уходят.
      setNear(undefined);
    }
    if (decided.current) return;
    decided.current = true;

    if (permission !== "granted") {
      setSettled(true);
      return;
    }
    const fresh = peekFresh();
    if (fresh) {
      setNear(fresh);
      setSettled(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), NEAR_WAIT_MS);
    });
    void Promise.race([locate(), deadline]).then((point) => {
      if (timer) clearTimeout(timer);
      if (!alive.current) return;
      if (point) setNear(point);
      setSettled(true);
    });
  }, [permission, peekFresh, locate, focusCount]);

  const applyPoint = useCallback((point: GeoPoint) => setNear(point), []);

  return { near, settled, applyPoint };
}
