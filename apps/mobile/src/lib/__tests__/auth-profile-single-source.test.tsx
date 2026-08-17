import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { AuthProvider, useAuth } from "../auth";

/**
 * РЕГРЕССИЯ 17.08.2026, найдена Дамиром на боевом сервере.
 *
 * Профиль жил в двух местах: своё состояние внутри AuthProvider и кеш запроса
 * ["me"], куда пишут экраны, которые профиль меняют. Гость вводил имя на
 * онбординге, оно уходило на сервер и в кеш — а провайдер продолжал держать
 * пустое. Экран подтверждения брони читает имя оттуда, поэтому писал «имя не
 * указано в профиле» и не давал подтвердить бронь. Имя при этом было и на
 * сервере, и в кеше: человек упирался в тупик там, где всё уже сделано.
 *
 * Тест держит ровно это свойство: кто угодно обновил ["me"] — auth отдаёт новое
 * значение, без отдельного «не забудь обновить ещё и там».
 */

const PROFILE = {
  id: "u-1",
  email: "",
  fullName: "Дамир",
  phone: "+77078692233",
  city: null,
  avatarUrl: null,
  birthDate: null,
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useAuth(), { wrapper }) };
}

describe("профиль в AuthProvider", () => {
  it("следует за кешем ['me'], который обновляет онбординг", async () => {
    const { queryClient, result } = setup();

    await waitFor(() => expect(result.current.user).toBeNull());

    // Ровно то, что делает экран онбординга после PATCH /users/me.
    act(() => {
      queryClient.setQueryData(["me"], PROFILE);
    });

    await waitFor(() => expect(result.current.user?.fullName).toBe("Дамир"));
  });
});
