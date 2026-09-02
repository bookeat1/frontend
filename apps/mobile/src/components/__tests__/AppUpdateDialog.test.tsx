import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { UpdatePrompt } from "../../lib/app-update";
import { AppUpdateDialog } from "../AppUpdateDialog";

/**
 * Разница между «попросили обновиться» и «дальше не пустим» — это то, что
 * гость может сделать с окном, а не то, как оно выглядит. В макете
 * (QovvuAoI9YxsLMwWkfgKN8, node 3623:9053) кнопка ОДНА — «Обновить», ни
 * крестика, ни «Позже» там нет. Значит единственный выход из мягкого окна —
 * подложка, и она обязана быть НАЗВАННОЙ: иначе для скринридера мягкое окно
 * ничем не отличается от жёсткого.
 */

const t = getDictionary();

const soft: UpdatePrompt = {
  kind: "store",
  title: "Доступно обновление",
  message: "Вышла новая версия BookEat.",
  blocking: false,
  storeUrl: "https://apps.apple.com/app/id6757542577",
};

const hard: UpdatePrompt = { ...soft, title: "Нужно обновить приложение", blocking: true };

function open(prompt: UpdatePrompt, overrides: Partial<React.ComponentProps<typeof AppUpdateDialog>> = {}) {
  const onAct = vi.fn();
  const onDismiss = vi.fn();
  render(
    <AppUpdateDialog
      prompt={prompt}
      acting={false}
      actionError={null}
      onAct={onAct}
      onDismiss={onDismiss}
      updateLabel={t.appUpdate.update}
      restartLabel={t.appUpdate.restart}
      closeLabel={t.common.close}
      {...overrides}
    />,
  );
  return { onAct, onDismiss };
}

describe("AppUpdateDialog", () => {
  it("без окна не рисует ничего", () => {
    open(soft, { prompt: null });
    expect(screen.queryByText(t.appUpdate.update)).toBeNull();
  });

  it("в окне ровно одна кнопка — та, что нарисована в макете", () => {
    open(soft);
    expect(screen.getByText(soft.title)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: t.appUpdate.update })).toHaveLength(1);
  });

  it("мягкий режим: подложка названа «Закрыть» и закрывает окно", () => {
    const { onDismiss, onAct } = open(soft);
    fireEvent.click(screen.getByRole("button", { name: t.common.close }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("жёсткий режим: закрыть нечем — подложки для скринридера нет", () => {
    const { onDismiss } = open(hard);
    expect(screen.getByText(hard.title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.common.close })).toBeNull();
    // И тапом мимо карточки тоже не закрывается.
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("кнопка обновления зовёт действие", () => {
    const { onAct } = open(soft);
    fireEvent.click(screen.getByText(t.appUpdate.update));
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("пока действие идёт, повторное нажатие ничего не делает", () => {
    // Вторая защита от двойного тапа (первая — в самом хуке): открыть магазин
    // дважды безобидно, но кнопка обязана выглядеть занятой, а не мёртвой.
    const { onAct } = open(soft, { acting: true });
    fireEvent.click(screen.getByText(t.appUpdate.update));
    expect(onAct).not.toHaveBeenCalled();
  });

  it("для обновления по воздуху кнопка называется перезапуском, а не обновлением", () => {
    open({ kind: "restart", title: "Доступно обновление", message: "…", blocking: false });
    expect(screen.getByText(t.appUpdate.restart)).toBeTruthy();
    expect(screen.queryByText(t.appUpdate.update)).toBeNull();
  });

  it("не открывшийся магазин виден в самом окне", () => {
    // В жёстком режиме это единственная кнопка: молчаливый отказ оставил бы
    // гостя перед окном без объяснения, почему ничего не происходит.
    open(hard, { actionError: t.appUpdate.openFailed });
    expect(screen.getByText(t.appUpdate.openFailed)).toBeTruthy();
  });
});
