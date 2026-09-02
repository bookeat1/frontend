import React from "react";
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
 */
export function AppUpdateGate() {
  const { dictionary } = useLocale();
  const { prompt, acting, actionError, act, dismiss } = useAppUpdate();

  return (
    <AppUpdateDialog
      prompt={prompt}
      acting={acting}
      actionError={actionError}
      onAct={act}
      onDismiss={dismiss}
      updateLabel={dictionary.appUpdate.update}
      restartLabel={dictionary.appUpdate.restart}
      closeLabel={dictionary.common.close}
    />
  );
}
