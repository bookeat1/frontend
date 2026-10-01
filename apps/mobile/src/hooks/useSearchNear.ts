import type { GeoPoint } from "@bookeat/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGuestLocation } from "../lib/geo/guest-location";

/** Сколько «Поиск» ждёт позицию, прежде чем уйти первым запросом без неё (3.8). */
export const NEAR_WAIT_MS = 1500;

/**
 * Откуда экран «Поиск» берёт `near` для запроса каталога (спека
 * geolocation-permission.md, сценарии 3.1, 3.8, 3.9, критерии 14, 16, 18).
 *
 * Правила за визит (визит = жизнь экрана):
 *  - статус ещё читается → ждём; разрешения нет → `settled`, `near` пуст;
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
  }, [permission, peekFresh, locate]);

  const applyPoint = useCallback((point: GeoPoint) => setNear(point), []);

  return { near, settled, applyPoint };
}
