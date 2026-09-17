import type { PushCampaignEstimate, PushCampaignSummary } from "@bookeat/api/admin";
import { AdminApiError } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Push-campaign control (push-campaigns-manual-spec-2026-09-17.md §4 criteria
 * 26-30): superadmin-only send button + modal on top of a badge everyone sees.
 *
 * `useIsPlatformAdmin` (from `lib/use-venue-catalog.ts`) reads `useAuth()`
 * from `@/lib/auth-context` — mocked here the same way
 * `PlatformPromosView.test.tsx` does, rather than mocking the hook module
 * directly, so the test exercises the real role check.
 */

const auth = { role: "admin" as string, token: "t" as string | null };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1", role: auth.role }, token: auth.token }),
}));

const { PushCampaignControl } = await import("../PushCampaignControl");

function estimate(over: Partial<PushCampaignEstimate> = {}): PushCampaignEstimate {
  return {
    city: "Алматы",
    in_city: 4120,
    no_device: 900,
    opted_out: 140,
    capped: 100,
    already_received: 0,
    eligible: 2980,
    quiet_hours_now: false,
    campaigns_today_in_city: 0,
    last_campaign: null,
    preview: {
      ru: { title: "Новое событие в «Абай»", body: "Джазовый вечер · 26.09 в 19:00" },
      kk: { title: "«Абай» жаңа іс-шара", body: "Джаз кеші · 26.09 19:00" },
      en: { title: "New event at Abai", body: "Jazz night · Sep 26, 7 PM" },
    },
    ...over,
  };
}

function campaign(over: Partial<PushCampaignSummary> = {}): PushCampaignSummary {
  return {
    subject_id: "e-1",
    id: "c-1",
    status: "done",
    created_at: "2026-09-17T09:00:00+05:00",
    finished_at: "2026-09-17T09:07:00+05:00",
    sent_count: 2975,
    skipped_count: 40,
    failed_count: 0,
    estimated_recipients: 2980,
    cancel_reason: null,
    ...over,
  };
}

function makeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    estimatePushCampaign: vi.fn(async () => estimate()),
    createPushCampaign: vi.fn(async () => ({
      id: "c-new",
      status: "queued" as const,
      estimated_recipients: 2980,
    })),
    ...over,
  };
}

function renderControl(
  client: ReturnType<typeof makeClient>,
  props: Partial<{ campaign: PushCampaignSummary | undefined }> = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSent = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <PushCampaignControl
        client={client}
        kind="event"
        subjectId="e-1"
        campaign={props.campaign}
        onSent={onSent}
      />
    </QueryClientProvider>,
  );
  return { onSent };
}

beforeEach(() => {
  auth.role = "admin";
  auth.token = "t";
});

afterEach(cleanup);

describe("бейдж по состоянию", () => {
  it("без кампании — «не отправлялся»", () => {
    renderControl(makeClient());
    expect(screen.getByText("Пуш: не отправлялся")).toBeTruthy();
  });

  it("queued/sending — «отправляется»", () => {
    renderControl(makeClient(), { campaign: campaign({ status: "sending" }) });
    expect(screen.getByText("Пуш: отправляется…")).toBeTruthy();
  });

  it("done — «отправлен DD.MM HH:mm · N»", () => {
    renderControl(makeClient(), { campaign: campaign({ status: "done" }) });
    expect(screen.getByText("Пуш отправлен 17.09 09:07 · 2975")).toBeTruthy();
  });
});

describe("роли", () => {
  it("суперадмин видит кнопку «Отправить пуш»", () => {
    auth.role = "admin";
    renderControl(makeClient());
    expect(screen.getByRole("button", { name: "Отправить пуш" })).toBeTruthy();
  });

  it("персонал заведения видит только бейдж, без кнопки", () => {
    auth.role = "restaurant";
    renderControl(makeClient());
    expect(screen.getByText("Пуш: не отправлялся")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Отправить пуш" })).toBeNull();
  });
});

describe("модалка отправки", () => {
  it("eligible = 0 — подтверждение задизейблено, текст объясняет почему", async () => {
    const client = makeClient({
      estimatePushCampaign: vi.fn(async () => estimate({ eligible: 0, in_city: 40, no_device: 40 })),
    });
    renderControl(client);
    fireEvent.click(screen.getByRole("button", { name: "Отправить пуш" }));

    expect(await screen.findByText(/Получателей нет/)).toBeTruthy();
    const confirmButton = screen.getByRole("button", { name: /Отправить 0 гостям/ });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
  });

  it("ночь: подтверждение заблокировано, пока не стоит галочка, дальше уходит force_quiet_hours", async () => {
    const client = makeClient({
      estimatePushCampaign: vi.fn(async () => estimate({ quiet_hours_now: true })),
    });
    const { onSent } = renderControl(client);
    fireEvent.click(screen.getByRole("button", { name: "Отправить пуш" }));

    const confirmButton = await screen.findByRole("button", { name: /Отправить 2980 гостям/ });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Сейчас ночь/)).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Понимаю, отправить сейчас" }));
    await waitFor(() => expect(confirmButton.hasAttribute("disabled")).toBe(false));

    fireEvent.click(confirmButton);
    await waitFor(() =>
      expect(client.createPushCampaign).toHaveBeenCalledWith({
        kind: "event",
        subject_id: "e-1",
        force_quiet_hours: true,
      }),
    );
    await waitFor(() => expect(onSent).toHaveBeenCalled());
  });

  it("409 — текст «уже отправляется», ввод не теряется, кнопка снова активна", async () => {
    const client = makeClient({
      createPushCampaign: vi.fn(async () => {
        throw new AdminApiError("conflict", 409);
      }),
    });
    renderControl(client);
    fireEvent.click(screen.getByRole("button", { name: "Отправить пуш" }));

    const confirmButton = await screen.findByRole("button", { name: /Отправить 2980 гостям/ });
    fireEvent.click(confirmButton);

    expect(
      await screen.findByText("По этой публикации уже идёт отправка — дождитесь её окончания."),
    ).toBeTruthy();
    // Модалка осталась открытой, кнопка снова кликабельна — это не потеря ввода.
    expect(screen.getByRole("button", { name: /Отправить 2980 гостям/ }).hasAttribute("disabled")).toBe(
      false,
    );
  });
});
