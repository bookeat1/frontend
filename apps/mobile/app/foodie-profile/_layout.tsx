import { Stack } from "expo-router";
import React from "react";
import { FoodieProfileDraftProvider } from "../../src/lib/foodie-profile-draft";

/**
 * Владеет черновиком визарда «Фуди-профиль» — см. комментарий у
 * `FoodieProfileDraftProvider` про то, почему React Context, а не параметры
 * маршрута. Тот же паттерн, что у флоу брони
 * (`app/restaurant/[id]/book/_layout.tsx`): черновик рождается при входе в
 * группу маршрутов и выбрасывается при выходе.
 */
export default function FoodieProfileLayout() {
  return (
    <FoodieProfileDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </FoodieProfileDraftProvider>
  );
}
