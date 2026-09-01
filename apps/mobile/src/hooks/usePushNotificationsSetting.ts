import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { openAppSettings } from "../lib/external-links";
import {
  notificationsToggleAction,
  notificationsView,
  registrationFailed,
  type NotificationsView,
} from "../lib/notification-settings";
import { readNotificationsPref, writeNotificationsPref } from "../lib/notifications-pref";
import { usePush } from "../lib/push";
import type { PushPermission } from "../lib/push-registration";

/**
 * Тумблер «Уведомления» на экране настроек: состояние и три его действия.
 *
 * Решения приняты в `lib/notification-settings.ts` — чистом файле без React и
 * Expo, который проверяется тестами напрямую. Здесь только то, ради чего нужен
 * хук: чтение системного разрешения, запись выбора, подписка на возвращение
 * приложения на передний план и защита от двойного нажатия.
 */
export interface NotificationsSetting extends NotificationsView {
  /** Разрешение и сохранённый выбор ещё читаются. */
  loading: boolean;
  /** Идёт системный диалог или запрос к серверу: переключатель заблокирован,
   * повторное нажатие безвредно. */
  working: boolean;
  /** Последняя попытка включить не довела токен до сервера. */
  failed: boolean;
  setEnabled(next: boolean): void;
  openSystemSettings(): void;
}

export function usePushNotificationsSetting(): NotificationsSetting {
  const push = usePush();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [pref, setPref] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Перечитать обе половины и, если гость разрешил уведомления снаружи
   * приложения, довести дело до конца — зарегистрировать токен.
   *
   * `push.enable()` здесь НЕ показывает системный диалог: разрешение уже
   * `granted`, и запрос в этом случае мгновенно возвращает согласие.
   * Регистратор сам схлопывает повторы (`unchanged`), так что на каждый
   * возврат в приложение лишнего запроса не будет.
   */
  const refresh = useCallback(async () => {
    const [nextPermission, nextPref] = await Promise.all([
      push.permission(),
      readNotificationsPref(),
    ]);
    if (!mounted.current) return;
    setPermission(nextPermission);
    setPref(nextPref);
    if (push.supported && nextPermission === "granted" && nextPref) {
      void push.enable();
    }
  }, [push]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Возврат на передний план. Без этого человек уходит в системные настройки,
   * разрешает уведомления там, возвращается — и продолжает читать «выключено».
   */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const setEnabled = useCallback(
    (next: boolean) => {
      // Двойное нажатие безвредно: второе просто не начинает вторую работу.
      if (busy.current) return;
      const action = notificationsToggleAction(next, {
        supported: push.supported,
        // До первого чтения ничего не решаем: `loading` держит строку
        // неактивной, но защита от гонки нужна и здесь.
        permission: permission ?? "undetermined",
      });
      if (action === "ignore" || permission === null) return;

      busy.current = true;
      setWorking(true);
      setFailed(false);
      void (async () => {
        try {
          if (action === "disable") {
            setPref(false);
            // Сначала запоминаем выбор, потом снимаем регистрацию: если
            // приложение умрёт между шагами, синхронизация при следующем
            // старте уже не вернёт токен обратно.
            await writeNotificationsPref(false);
            await push.disable();
            return;
          }

          // Намерение записываем ДО системного диалога и до ухода в настройки
          // телефона: гость может разрешить уведомления снаружи и вернуться,
          // и `refresh` должен знать, что он этого хотел.
          setPref(true);
          await writeNotificationsPref(true);

          if (action === "open-settings") {
            openSystemSettings();
            return;
          }

          const outcome = await push.enable();
          const nextPermission = await push.permission();
          if (!mounted.current) return;
          setPermission(nextPermission);
          if (registrationFailed(outcome)) {
            setFailed(true);
            setPref(false);
            await writeNotificationsPref(false);
          }
        } finally {
          busy.current = false;
          if (mounted.current) setWorking(false);
        }
      })();
    },
    [permission, push],
  );

  const view = notificationsView({
    supported: push.supported,
    permission: permission ?? "undetermined",
    pref: pref ?? false,
  });

  return {
    ...view,
    loading: permission === null || pref === null,
    working,
    failed,
    setEnabled,
    openSystemSettings,
  };
}

/** Вынесено из хука, чтобы ссылка не менялась между рендерами. */
function openSystemSettings(): void {
  void openAppSettings();
}
