import { exploreLayout } from "@bookeat/design-tokens";

/**
 * Высота шапки главной = верхняя безопасная зона устройства + 264
 * (макет 3z0f6dgev4HMwBAHPjTjPo, node 3102:11986).
 *
 * Правило вынесено из компонента в отдельный модуль по одной причине:
 * `HomeHeader.tsx` тянет фотографию через `require(...jpg)`, и Node в тесте
 * пытается разобрать jpg как модуль — отрендерить шапку в vitest нельзя (та же
 * причина, по которой её подменяет `home-party-selectors.test.tsx`). Правило
 * при этом проверяемое, и проверяется оно здесь: `__tests__/
 * home-header-layout.test.ts`.
 *
 * Почему «вставка + 264», а не 308 целиком: 308 в макете — это высота вместе
 * со статус-баром макетного устройства (44). На реальных телефонах вставка
 * другая (20 на старых iPhone, 62 на Pixel с камерой в экране), и жёсткие 308
 * означали бы разное количество места под содержимое на разных устройствах.
 */
export function homeHeaderHeight(topInset: number): number {
  return topInset + exploreLayout.headerContentHeight;
}
