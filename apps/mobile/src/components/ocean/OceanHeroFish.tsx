import { colors } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * РЫБЫ-СИЛУЭТЫ в шапке Ocean Basket — макет 3z0f6dgev4HMwBAHPjTjPo, узлы
 * 3443:12520, 3443:12522, 3443:12524, 3443:12526, 3443:12528.
 *
 * Контур ВЫГРУЖЕН ИЗ МАКЕТА, а не нарисован от руки: это `fillGeometry` узла
 * (`GET /v1/files/:key?ids=3425:3926&geometry=paths`, снято 2026-09-01), один
 * и тот же у всех пяти рыб — крупные 27×18, мелкие те же 27×18 в масштабе
 * 0.75. Цвет и прозрачность тоже из макета: #8C947A 66 %.
 *
 * ПОЛОЖЕНИЕ СЧИТАЕТСЯ ОТ КРАЁВ КАДРА, а не от его ширины: макет нарисован на
 * 390, а экраны бывают от 360 до 430, и рыба, привязанная к «91 % ширины»,
 * на узком телефоне заехала бы на надпись. Левые рыбы держатся левого края,
 * правые — правого, ровно на том расстоянии, что нарисовано.
 */

/** Контур одной рыбы в системе координат 27×18 (node 3443:12524). */
export const OCEAN_FISH_PATH =
  "M0 9C4.8 1.8 12 0 19.5 4.5L27 0L27 18L19.5 13.5C12 18 4.8 16.2 0 9Z";

const FISH_VIEWBOX_WIDTH = 27;
const FISH_VIEWBOX_HEIGHT = 18;

/** Пять рыб макета: размер, отступ от своего края и поворот — как нарисовано. */
const FISH: readonly {
  id: string;
  width: number;
  height: number;
  top: number;
  left?: number;
  right?: number;
  rotateDeg?: number;
}[] = [
  // node 3443:12524
  { id: "left-top", width: 27, height: 18, top: 78, left: 10 },
  // node 3443:12520
  { id: "right-top", width: 20.25, height: 13.5, top: 79, right: 13.75 },
  // node 3443:12528
  { id: "left-middle", width: 20.25, height: 13.5, top: 179, left: 26 },
  // node 3443:12526
  { id: "right-middle", width: 20.25, height: 13.5, top: 189, right: 51.75 },
  // node 3443:12522 — единственная повёрнутая: 0.1369 радиана против часовой.
  { id: "right-bottom", width: 27, height: 18, top: 263, right: 4.8, rotateDeg: -7.84 },
];

export function OceanHeroFish({ offsetTop }: { offsetTop: number }) {
  return (
    <>
      {FISH.map((fish) => (
        <View
          key={fish.id}
          pointerEvents="none"
          style={[
            styles.fish,
            {
              top: offsetTop + fish.top,
              left: fish.left,
              right: fish.right,
              transform: fish.rotateDeg ? [{ rotate: `${fish.rotateDeg}deg` }] : undefined,
            },
          ]}
        >
          <Svg
            width={fish.width}
            height={fish.height}
            viewBox={`0 0 ${FISH_VIEWBOX_WIDTH} ${FISH_VIEWBOX_HEIGHT}`}
          >
            <Path d={OCEAN_FISH_PATH} fill={colors.brand2.heroFish} />
          </Svg>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  fish: {
    position: "absolute",
  },
});
