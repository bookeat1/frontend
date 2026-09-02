import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { UpdatePrompt } from "../../lib/app-update";
import { AppUpdateDialog } from "../AppUpdateDialog";

/**
 * Разница между «попросили обновиться» и «дальше не пустим» — это то, что
 * гость может сделать с окном, а не то, как оно выглядит.
 *
 * У закрываемого окна есть НАСТОЯЩАЯ кнопка «Позже» (решение владельца
 * 02.09.2026), и она обязана быть кнопкой, а не подложкой: для скринридера
 * безымянная цель во весь экран и мягкое окно неотличимы от жёсткого. У
 * жёсткого окна этой кнопки нет вовсе — окно, которое нельзя закрыть, не
 * должно показывать кнопку, притворяющуюся выходом.
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
      laterLabel={t.appUpdate.later}
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

  it("в мягком окне две кнопки: «Обновить» и «Позже»", () => {
    open(soft);
    expect(screen.getByText(soft.title)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: t.appUpdate.update })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: t.appUpdate.later })).toHaveLength(1);
  });

  it("мягкий режим: «Позже» закрывает окно и никуда не уводит", () => {
    const { onDismiss, onAct } = open(soft);
    fireEvent.click(screen.getByRole("button", { name: t.appUpdate.later }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("жёсткий режим: кнопки «Позже» нет вовсе", () => {
    const { onDismiss } = open(hard);
    expect(screen.getByText(hard.title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.appUpdate.later })).toBeNull();
    // И тапом мимо карточки тоже не закрывается.
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("пока магазин открывается, «Позже» тоже не нажимается", () => {
    // Иначе двойной тап «Обновить» + «Позже» снял бы окно ровно в тот момент,
    // когда приложение уже уходит в магазин.
    const { onDismiss } = open(soft, { acting: true });
    fireEvent.click(screen.getByRole("button", { name: t.appUpdate.later }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("у обновления по воздуху «Позже» тоже есть", () => {
    // Оно закрываемое по определению: бандл уже на телефоне и применится сам.
    const { onDismiss } = open({
      kind: "restart",
      title: "Доступно обновление",
      message: "…",
      blocking: false,
    });
    fireEvent.click(screen.getByRole("button", { name: t.appUpdate.later }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
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
