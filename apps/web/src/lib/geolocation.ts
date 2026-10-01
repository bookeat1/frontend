"use client";

import type { GeoPoint } from "@bookeat/api/client";
import { useCallback, useEffect, useState } from "react";

/**
 * Геопозиция гостя в браузере (спека geolocation-permission.md, W1, критерии
 * 25-26). Нужна одной вещи: сортировке каталога «Сначала ближайшие».
 *
 * ПРАВИЛА:
 *  - Системный запрос разрешения — ТОЛЬКО по жесту гостя. `locate()` вызывают
 *    из `onChange` селекта сортировки и из клика по «Показать ближайшие» и
 *    больше ниоткуда; хук сам НЕ зовёт `getCurrentPosition` при монтировании.
 *    Исключение одно: на странице с `?sort=nearest` при УЖЕ выданном
 *    разрешении (`granted`) экран зовёт `locate()` сам — диалога при этом нет.
 *  - Координаты живут ТОЛЬКО в памяти вкладки (переменная модуля и состояние
 *    хука): не в URL, не в localStorage/sessionStorage, не в cookie, поэтому и
 *    не в `[Amplitude] Page Location`. Не уходят в аналитику и в логи.
 *  - Повторный вызов в пределах 10 минут отдаёт запомненную позицию.
 */

export const GEO_TTL_MS = 10 * 60 * 1000;
export const GEO_TIMEOUT_MS = 8000;

/** `unknown` — статус ещё читается. Без Permissions API считаем `prompt`. */
export type GeoPermissionState = "unknown" | "prompt" | "granted" | "denied";

export type GeoResult =
  | { ok: true; point: GeoPoint }
  | { ok: false; reason: "denied" | "unavailable" };

let remembered: { point: GeoPoint; at: number } | null = null;

/** Только для тестов: у модуля есть память, а тесты должны стартовать пустыми. */
export function resetRememberedLocation(): void {
  remembered = null;
}

function freshRemembered(): GeoPoint | null {
  if (!remembered) return null;
  return Date.now() - remembered.at <= GEO_TTL_MS ? remembered.point : null;
}

async function readPermission(): Promise<{
  state: GeoPermissionState;
  status: PermissionStatus | null;
}> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return { state: "prompt", status: null };
    }
    const status = await navigator.permissions.query({ name: "geolocation" });
    return { state: status.state, status };
  } catch {
    return { state: "prompt", status: null };
  }
}

export function useBrowserGeolocation(): {
  permission: GeoPermissionState;
  /** Позиция, полученная в этой вкладке (в памяти), или `null`. */
  point: GeoPoint | null;
  /** Определить позицию. Вызывать ТОЛЬКО из обработчика жеста — синхронно. */
  locate: () => Promise<GeoResult>;
} {
  const [permission, setPermission] = useState<GeoPermissionState>("unknown");
  const [point, setPoint] = useState<GeoPoint | null>(freshRemembered);

  useEffect(() => {
    let alive = true;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (alive && status) setPermission(status.state);
    };
    void readPermission().then((read) => {
      if (!alive) return;
      status = read.status;
      setPermission(read.state);
      status?.addEventListener?.("change", onChange);
    });
    return () => {
      alive = false;
      status?.removeEventListener?.("change", onChange);
    };
  }, []);

  const locate = useCallback((): Promise<GeoResult> => {
    const cached = freshRemembered();
    if (cached) {
      setPoint(cached);
      return Promise.resolve({ ok: true, point: cached });
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return Promise.resolve({ ok: false, reason: "unavailable" });
    }
    // Вызов СИНХРОННЫЙ в теле функции: браузер засчитывает жест только так.
    return new Promise<GeoResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = { lat: position.coords.latitude, lng: position.coords.longitude };
          remembered = { point: next, at: Date.now() };
          setPoint(next);
          setPermission("granted");
          resolve({ ok: true, point: next });
        },
        (error) => {
          if (error.code === 1) setPermission("denied");
          resolve({ ok: false, reason: error.code === 1 ? "denied" : "unavailable" });
        },
        // Приблизительной позиции хватает: нужен порядок внутри города.
        { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_TTL_MS },
      );
    });
  }, []);

  return { permission, point, locate };
}
