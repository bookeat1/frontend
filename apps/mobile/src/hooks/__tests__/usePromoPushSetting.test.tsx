import type { NotificationPreferences, RestaurantRepository } from "@bookeat/api";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePromoPushSetting } from "../usePromoPushSetting";

/**
 * push-campaigns spec, §4 criterion 34 — the «Акции и события» toggle.
 *
 * Three things that break silently if untested:
 *   1. the switch reads its STARTING value from the server, not a guess;
 *   2. a flip sends the FULL four-field body — never just the one field the
 *      screen changed, so an old/other client's other three settings are
 *      never at risk from this screen;
 *   3. a network failure on flip rolls back to what it was BEFORE the tap,
 *      not to some later, possibly stale server read, and surfaces `failed`.
 */

const PREFS: NotificationPreferences = {
  notificationsEnabled: true,
  pushEnabled: true,
  emailEnabled: false,
  promoPushEnabled: true,
  updatedAt: "2026-09-17T10:00:00Z",
};

const repository = {
  getNotificationPreferences: vi.fn(),
  setNotificationPreferences: vi.fn(),
} as unknown as RestaurantRepository & {
  getNotificationPreferences: ReturnType<typeof vi.fn>;
  setNotificationPreferences: ReturnType<typeof vi.fn>;
};

vi.mock("../../lib/repository", () => ({
  useRepository: () => repository,
}));

beforeEach(() => {
  vi.clearAllMocks();
  repository.getNotificationPreferences.mockResolvedValue(PREFS);
});

describe("usePromoPushSetting", () => {
  it("reads the starting value from the server on mount", async () => {
    const { result } = renderHook(() => usePromoPushSetting());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.value).toBe(true);
    expect(repository.getNotificationPreferences).toHaveBeenCalledTimes(1);
  });

  it("a flip sends all four fields, not just promoPushEnabled", async () => {
    repository.setNotificationPreferences.mockResolvedValue({ ...PREFS, promoPushEnabled: false });
    const { result } = renderHook(() => usePromoPushSetting());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setEnabled(false);
    });

    await waitFor(() => expect(result.current.value).toBe(false));
    expect(repository.setNotificationPreferences).toHaveBeenCalledWith({
      notificationsEnabled: true,
      pushEnabled: true,
      emailEnabled: false,
      promoPushEnabled: false,
    });
  });

  it("optimistically flips at once, before the server answers", async () => {
    let resolveWrite!: (value: NotificationPreferences) => void;
    repository.setNotificationPreferences.mockReturnValue(
      new Promise<NotificationPreferences>((resolve) => {
        resolveWrite = resolve;
      }),
    );
    const { result } = renderHook(() => usePromoPushSetting());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setEnabled(false);
    });
    expect(result.current.value).toBe(false);
    expect(result.current.working).toBe(true);

    await act(async () => {
      resolveWrite({ ...PREFS, promoPushEnabled: false });
    });
    await waitFor(() => expect(result.current.working).toBe(false));
  });

  it("rolls back to the value BEFORE the tap on a network failure, and reports failed", async () => {
    repository.setNotificationPreferences.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => usePromoPushSetting());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.value).toBe(true);

    await act(async () => {
      result.current.setEnabled(false);
    });

    await waitFor(() => expect(result.current.failed).toBe(true));
    // Back to true — what it was before this tap — not left at false.
    expect(result.current.value).toBe(true);
    expect(result.current.working).toBe(false);
  });

  it("a second tap while a write is in flight is ignored", async () => {
    let resolveWrite!: (value: NotificationPreferences) => void;
    repository.setNotificationPreferences.mockReturnValue(
      new Promise<NotificationPreferences>((resolve) => {
        resolveWrite = resolve;
      }),
    );
    const { result } = renderHook(() => usePromoPushSetting());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setEnabled(false);
      result.current.setEnabled(true);
    });

    expect(repository.setNotificationPreferences).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveWrite({ ...PREFS, promoPushEnabled: false });
    });
  });
});
