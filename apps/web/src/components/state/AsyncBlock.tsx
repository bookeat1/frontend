"use client";

import type { ReactNode } from "react";

import { Button } from "@web/components/ui/Button";
import { isApiConfigured } from "@web/lib/api";
import { cx } from "@web/lib/cx";
import { useT } from "@web/lib/locale";

/**
 * Четыре состояния любого блока с данными в одном месте: загрузка, ошибка,
 * пусто, есть данные.
 *
 * Существует, чтобы «пусто» и «сеть отвалилась» не расползлись по экранам
 * тремя разными формулировками и чтобы ни один блок не мог случайно
 * обойтись без одного из состояний — здесь их просто нельзя не передать.
 *
 * Отдельно обрабатывается «в сборке нет адреса API»: запрос в этом случае
 * ВЫКЛЮЧЕН, и без этой ветки блок навсегда остался бы в состоянии загрузки.
 */
export interface AsyncBlockQuery<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

export interface AsyncBlockProps<T> {
  query: AsyncBlockQuery<T>;
  /** Скелет ровно той высоты, что и содержимое: страница не должна прыгать. */
  skeleton: ReactNode;
  /** Текст пустого состояния — словами, а не пустым местом. */
  emptyText: string;
  /** Своя разметка пустого состояния, когда одного предложения мало: на
   * листинге к нему нужна кнопка «сбросить фильтры». */
  empty?: ReactNode;
  /** По умолчанию пустым считается пустой массив. */
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}

function defaultIsEmpty(data: unknown): boolean {
  return Array.isArray(data) && data.length === 0;
}

export function AsyncBlock<T>({
  query,
  skeleton,
  emptyText,
  empty,
  isEmpty = defaultIsEmpty as (data: T) => boolean,
  children,
}: AsyncBlockProps<T>) {
  const t = useT();

  if (!isApiConfigured) {
    return (
      <StateMessage
        title={t.web.states.notConfiguredTitle}
        text={t.web.states.notConfiguredText}
        tone="danger"
      />
    );
  }

  if (query.isError) {
    return (
      <StateMessage title={t.web.states.errorTitle} text={t.web.states.errorText} tone="danger">
        <Button size="m" variant="secondary" onClick={() => query.refetch()}>
          {t.web.states.retry}
        </Button>
      </StateMessage>
    );
  }

  if (query.isPending || query.data === undefined) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{t.web.states.loading}</span>
        {skeleton}
      </div>
    );
  }

  if (isEmpty(query.data)) {
    return <>{empty ?? <StateMessage text={emptyText} tone="muted" />}</>;
  }

  return <>{children(query.data)}</>;
}

/** Плашка состояния: заголовок, объяснение и, если есть, действие. */
export function StateMessage({
  title,
  text,
  tone = "muted",
  children,
  className,
}: {
  title?: string;
  text: string;
  tone?: "muted" | "danger";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cx(
        "flex flex-col items-start gap-3 rounded-lg border px-6 py-8",
        tone === "danger" ? "border-danger-text bg-danger" : "border-line bg-subtle",
        className,
      )}
    >
      {title ? <p className="text-[18px] font-semibold leading-6 text-ink">{title}</p> : null}
      <p className="max-w-[560px] text-bodyM text-ink-secondary">{text}</p>
      {children}
    </div>
  );
}

/** Серый прямоугольник-заглушка на время загрузки. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-lg bg-muted", className)} />;
}
