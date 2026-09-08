import React from "react";
import { Platform } from "react-native";
import { useAppUpdate } from "../hooks/useAppUpdate";
import { useLocale } from "../lib/locale";
import { AppUpdateDialog } from "./AppUpdateDialog";

/**
 * Единственная точка, где приложение спрашивает «а не пора ли обновиться».
 *
 * Живёт в RootLayout ВОКРУГ навигации, а не на экране: вопрос не про экран, и
 * жёсткий режим обязан накрывать любой из них, включая тот, на который гость
 * вернулся по пуш-уведомлению.
 *
 * Пока показывать нечего (а это подавляющее большинство запусков), рисует
 * `null` и ничего не стоит: сетевой вызов один на запуск, без него не
 * обходится ни один вариант этой фичи.
 *
 * Подписи кнопок берутся из ЖИВОГО словаря (`useLocale`), а не из
 * `getDictionary()` на уровне модуля: смена языка обязана менять их без
 * перезапуска, и здесь это особенно важно — окно может висеть поверх экрана
 * настроек, где язык и переключают.
 *
 * MW-3 (ADR-046): на вебе `prompt` и так всегда `null` — `useAppUpdate` уже
 * не спрашивает бэкенд про версию магазина (`storePlatform()` возвращает
 * `null` для web) и `Updates.useUpdates()` резолвится через `updates.web.ts`
 * (MW-2) в `{ isUpdatePending: false }`, так что "обновиться по воздуху"
 * тоже нечего предлагать. `Platform.OS === "web"` ниже — явная страховка на
 * уровне компонента поверх этого, а не что-то, что нужно выводить из трёх
 * файлов; хуки при этом вызываются безусловно (иначе react-hooks/rules-of-
 * hooks), сам ранний выход — только в JSX.
 */
export function AppUpdateGate() {
  const { dictionary } = useLocale();
  const { prompt, acting, actionError, act, dismiss } = useAppUpdate();

  if (Platform.OS === "web") return null;

  return (
    <AppUpdateDialog
      prompt={prompt}
      acting={acting}
      actionError={actionError}
      onAct={act}
      onDismiss={dismiss}
      updateLabel={dictionary.appUpdate.update}
      restartLabel={dictionary.appUpdate.restart}
      laterLabel={dictionary.appUpdate.later}
    />
  );
}
