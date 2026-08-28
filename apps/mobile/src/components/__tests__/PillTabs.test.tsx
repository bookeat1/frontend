import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PillTabs } from "../PillTabs";

/**
 * Переключатель «Активные / История» с экрана броней (Figma
 * 3z0f6dgev4HMwBAHPjTjPo, node 3053:10074) — сегментированная дорожка с
 * белой половиной у выбранной вкладки.
 *
 * Проверяется ровно то, что ломается молча: нажатие сообщает номер вкладки, а
 * активная вкладка помечена в дереве доступности. Пометка тут ВАЖНЕЕ обычного:
 * в макете выбранную половину отличает только белая заливка — ни цвета, ни
 * начертания подписи, — и без `aria-selected` скринридер не узнает, какой
 * раздел открыт. Пиксели заливки глаз увидит и сам, а «нажал История, а
 * помечено Активные» на макете не поймает.
 */

const LABELS = ["Активные", "История"];

describe("PillTabs", () => {
  it("рисует все вкладки и помечает активную", () => {
    render(<PillTabs labels={LABELS} activeIndex={0} onChange={vi.fn()} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(LABELS);
    // `aria-selected`, а не `accessibilityState`: react-native-web последнее
    // в DOM не выносит, поэтому компонент помечает вкладку именно так.
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Активные");
  });

  it("переносит пометку на вторую вкладку, когда активна она", () => {
    render(<PillTabs labels={LABELS} activeIndex={1} onChange={vi.fn()} />);

    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("История");
  });

  it("сообщает номер нажатой вкладки", () => {
    const onChange = vi.fn();
    render(<PillTabs labels={LABELS} activeIndex={0} onChange={onChange} />);

    screen.getByRole("tab", { name: "История" }).click();

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("сообщает и повторное нажатие на уже активную вкладку", () => {
    // Экран сам решает, что делать с повтором. Проглатывать его здесь —
    // значит спрятать событие от того, кто, возможно, хочет по нему
    // прокрутить список наверх.
    const onChange = vi.fn();
    render(<PillTabs labels={LABELS} activeIndex={0} onChange={onChange} />);

    screen.getByRole("tab", { name: "Активные" }).click();

    expect(onChange).toHaveBeenCalledWith(0);
  });
});
