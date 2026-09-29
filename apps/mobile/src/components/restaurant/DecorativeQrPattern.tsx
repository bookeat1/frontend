import { colors } from "@bookeat/design-tokens";
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

/**
 * QR-паттерн шторки «QR-код лояльности» (`LoyaltyQrSheet`, Figma node
 * 5455:6737) — ДЕКОРАТИВНАЯ ГРАФИКА, не настоящий QR-код.
 *
 * У бэкенда нет ни ручки, отдающей персональный код лояльности гостя, ни
 * самой программы лояльности (решение владельца 2026-09-29). Кодировать
 * здесь буквально нечего — значит и тащить библиотеку кодирования (вроде
 * `uqr`, которой на этот же случай пользуется `apps/web/src/components/ui/QrCode.tsx`)
 * незачем. Вместо этого — фиксированный псевдослучайный узор 21×21 (размер
 * модульной сетки QR версии 1, для правдоподобия) с тремя "глазами"-квадратами
 * по углам — так его рисует любой настоящий QR, и так он нарисован в макете.
 *
 * Матрица посчитана ОДИН РАЗ на загрузку модуля через детерминированный
 * генератор (сид зашит в код, не `Math.random()` на каждый рендер) — иначе
 * узор дрожал бы при каждой перерисовке родителя. Рисуется, как в веб-версии,
 * горизонтальными полосами (`runsOf`) вместо модуля на модуль — на порядок
 * меньше узлов `<Rect>` при той же картинке.
 *
 * Декоративная — значит и озвучивать её скринридеру нечего: у неё есть
 * подпись рядом (заголовок шторки и код цифрами), сам узор для диктора
 * скрыт целиком.
 */
export function DecorativeQrPattern({ size }: { size: number }) {
  const runs = useMemo(() => runsOf(MATRIX), []);

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg viewBox={`0 0 ${GRID} ${GRID}`} width={size} height={size}>
        {runs.map((run) => (
          <Rect
            key={`${run.y}-${run.x}`}
            x={run.x}
            y={run.y}
            width={run.width}
            height={1}
            fill={colors.text.strong}
          />
        ))}
      </Svg>
    </View>
  );
}

/** Размер сетки — как у настоящего QR версии 1 (21×21). */
const GRID = 21;
/** Размер "глаза"-квадрата в углу настоящего QR — 7×7. */
const FINDER = 7;
/** Сид генератора — просто число, не значение из макета: узор не считан ни с
 * какого реального кода. */
const SEED = 0x2718;

const MATRIX = buildMatrix();

function buildMatrix(): boolean[][] {
  const noise = seededBits(SEED, GRID);
  const finderOrigins: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [GRID - FINDER, 0],
    [0, GRID - FINDER],
  ];
  return noise.map((row, y) =>
    row.map((bit, x) => {
      const origin = finderOrigins.find(
        ([zx, zy]) => x >= zx && x < zx + FINDER && y >= zy && y < zy + FINDER,
      );
      if (!origin) return bit;
      return isFinderModule(x - origin[0], y - origin[1]);
    }),
  );
}

/** Глаз QR — тёмная рамка 7×7, светлое кольцо, тёмный центр 3×3. */
function isFinderModule(localX: number, localY: number): boolean {
  const isOuterRing = localX === 0 || localX === FINDER - 1 || localY === 0 || localY === FINDER - 1;
  const isCore = localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
  return isOuterRing || isCore;
}

/** xorshift32 — детерминированный и без зависимостей, качество случайности
 * для декоративного узора не имеет значения. */
function seededBits(seed: number, size: number): boolean[][] {
  let state = seed;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state |= 0;
    return (state >>> 0) / 0xffffffff;
  };
  const grid: boolean[][] = [];
  for (let y = 0; y < size; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x += 1) row.push(next() < 0.45);
    grid.push(row);
  }
  return grid;
}

interface Run {
  x: number;
  y: number;
  width: number;
}

/** Соседние тёмные модули одной строки — один прямоугольник, не модуль на
 * модуль (тот же приём, что в веб-версии, см. комментарий файла). */
function runsOf(matrix: boolean[][]): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < matrix.length; y += 1) {
    const row = matrix[y];
    let start = -1;
    for (let x = 0; x <= row.length; x += 1) {
      const dark = x < row.length && row[x] === true;
      if (dark && start === -1) start = x;
      if (!dark && start !== -1) {
        runs.push({ x: start, y, width: x - start });
        start = -1;
      }
    }
  }
  return runs;
}
