import type { AppUpdateDecision } from "@bookeat/api";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import {
  pickPrompt,
  restartUpdatePrompt,
  storeUpdatePrompt,
  type UpdatePrompt,
  type UpdatePromptKind,
} from "../lib/app-update";
import { openStoreListing } from "../lib/external-links";
import { useLocale } from "../lib/locale";
import { reloadApp } from "../lib/reload-app";
import { useRepository } from "../lib/repository";

/**
 * Не спрашивать сервер чаще, чем он сам разрешает кэшировать ответ
 * (`Cache-Control: public, max-age=300` у `/app/version-check`). Гость,
 * который весь день сворачивает и разворачивает приложение, не должен
 * превращаться в поток запросов; при этом включённый в панели режим доезжает
 * до него за минуты, а не к следующему релизу.
 */
const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Платформы, про которые сервер вообще умеет отвечать. Веб-сборка (`expo
 * start --web`) не спрашивает ничего: обновлять там нечего. */
function storePlatform(): "ios" | "android" | null {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return null;
}

/**
 * Маркетинговая версия ЭТОЙ сборки.
 *
 * Источник — скомпилированный app config, как и на экране «Настройки». У него
 * есть известная особенность: после обновления по воздуху здесь оказывается
 * версия из МАНИФЕСТА ОБНОВЛЕНИЯ, а не из бинаря в магазине (см. ранбук OTA).
 * Пока мы не публикуем по воздуху бандл с поднятой версией на старый бинарь,
 * это одно и то же число. Настоящую версию бинаря знает только нативная часть
 * (`expo-application`), а её нельзя трогать статическим импортом в уже
 * выпущенных сборках — поэтому здесь честный компромисс, а не скрытая правда.
 */
function buildVersion(): string {
  return Constants.expoConfig?.version ?? "";
}

export interface AppUpdateState {
  /** Что показать. `null` — показывать нечего, и это нормальный исход. */
  prompt: UpdatePrompt | null;
  /** Кнопка в работе: магазин открывается или бандл перезапускается. */
  acting: boolean;
  /** Действие не удалось (магазин не открылся). Уже переведено. */
  actionError: string | null;
  /** Главная кнопка окна. Безопасна к двойному нажатию. */
  act: () => void;
  /** «Позже». В жёстком режиме окно этого не предлагает. */
  dismiss: () => void;
}

/**
 * Проверка обновлений на старте и при возвращении в приложение.
 *
 * ДВА независимых источника, у каждого своя ветка:
 *
 *  1. СЕРВЕР (`GET /app/version-check`) — «в магазине новая сборка».
 *     Приложение обновить себя не может, кнопка уводит в магазин. Режим
 *     («попросить» или «не пускать») задан в панели, клиент его не выбирает.
 *  2. EXPO-UPDATES — обновление по воздуху уже СКАЧАНО и ждёт холодного
 *     старта (`useUpdates().isUpdatePending`; загрузку запускает сам
 *     expo-updates при запуске, `checkAutomatically` по умолчанию `ON_LOAD`).
 *     Кнопка перезапускает бандл, магазин не нужен.
 *
 * Четыре состояния асинхронной поверхности здесь выглядят так, и это
 * осознанно: ЗАГРУЗКА невидима (проверка фоновая, показывать спиннер поверх
 * приложения не за что), ПУСТО и ОШИБКА — это молчание (ошибку сети нельзя
 * превращать ни в требование обновиться, ни в сообщение о неудаче: гость не
 * просил проверять), УСПЕХ — окно. Ошибка ВИДНА только там, где её причинил
 * сам гость: не открылся магазин после нажатия на кнопку.
 */
export function useAppUpdate(): AppUpdateState {
  const repository = useRepository();
  const { locale, dictionary } = useLocale();

  // Хранится ОТВЕТ СЕРВЕРА, а не готовое окно: тексты выбираются по языку в
  // момент отрисовки, поэтому переключение языка меняет и уже открытое окно.
  const [decision, setDecision] = useState<AppUpdateDecision | null>(null);
  // «Позже» помнится ОТДЕЛЬНО для каждого случая: отказ от похода в магазин не
  // должен прятать предложение перезапуститься, это разные вещи и разная цена.
  const [dismissed, setDismissed] = useState<Record<UpdatePromptKind, boolean>>({
    store: false,
    restart: false,
  });
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Время последней УДАЧНОЙ проверки. В ref, а не в state: оно ни на что не
  // влияет на экране, а перерисовка из-за него была бы лишней.
  const lastCheckAt = useRef(0);
  const checking = useRef(false);

  // Обновление по воздуху: скачано и ждёт перезапуска. Хук сам подписан на
  // нативную машину состояний, поэтому отдельная проверка не нужна.
  const { isUpdatePending } = Updates.useUpdates();

  const check = useCallback(async () => {
    const platform = storePlatform();
    if (!platform) return;
    if (checking.current) return;
    if (Date.now() - lastCheckAt.current < MIN_CHECK_INTERVAL_MS) return;
    checking.current = true;
    try {
      const answer = await repository.checkAppUpdate({
        platform,
        version: buildVersion(),
      });
      lastCheckAt.current = Date.now();
      setDecision(answer);
    } catch {
      // Молчим. Сеть отвалилась, сервер ответил 500, ручки ещё нет на этом
      // стенде — ни один из этих случаев не даёт нам права что-то утверждать
      // про версию, а окно «обновитесь» на догадке хуже, чем его отсутствие.
    } finally {
      checking.current = false;
    }
  }, [repository]);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      // Только возвращение в приложение. Уход в фон ничего не проверяет.
      if (next === "active") void check();
    });
    return () => subscription.remove();
  }, [check]);

  // «Позже» действует до конца этого запуска приложения и НЕ переживает
  // холодный старт: отдельного хранилища на это не заводим, а мягкая просьба,
  // забытая навсегда, — это просьба, которую никто не увидит. Жёсткий режим
  // закрыть нельзя вовсе, поэтому флаг для него не читается.
  //
  // Отсев идёт ДО выбора между случаями, а не после: иначе снятая просьба
  // «сходить в магазин» проглотила бы и предложение перезапуститься, которое
  // гость ещё не видел, — оба ушли бы в одно и то же «Позже».
  const visible = (candidate: UpdatePrompt | null) =>
    candidate && (candidate.blocking || !dismissed[candidate.kind]) ? candidate : null;

  const storePrompt = visible(decision ? storeUpdatePrompt(decision, locale, dictionary) : null);
  const otaPrompt = visible(isUpdatePending ? restartUpdatePrompt(dictionary) : null);
  const prompt = pickPrompt(storePrompt, otaPrompt);

  const act = useCallback(() => {
    if (!prompt || acting) return;
    setActionError(null);
    if (prompt.kind === "restart") {
      setActing(true);
      // reloadApp() не бросает и сам выбирает доступный способ перезапуска.
      // Флаг НЕ снимаем: удачный перезапуск уносит этот экран целиком, а
      // неудачный (сборка без expo-updates) оставляет кнопку неактивной —
      // это честнее, чем кнопка, которая раз за разом ничего не делает.
      reloadApp();
      return;
    }
    const url = prompt.storeUrl;
    if (!url) return;
    setActing(true);
    void openStoreListing(url)
      .then((opened) => {
        if (!opened) setActionError(dictionary.appUpdate.openFailed);
      })
      .finally(() => setActing(false));
  }, [acting, dictionary, prompt]);

  const dismiss = useCallback(() => {
    if (!prompt || prompt.blocking) return;
    const kind = prompt.kind;
    setDismissed((current) => ({ ...current, [kind]: true }));
  }, [prompt]);

  return { prompt, acting, actionError, act, dismiss };
}
