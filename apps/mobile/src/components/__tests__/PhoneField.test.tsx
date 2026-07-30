import { fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { PhoneField } from "../PhoneField";

/**
 * REGRESSION GUARD — маскированное поле, которое сопротивляется правке.
 *
 * Разбор ввода проверен отдельно (lib/__tests__/phone-input.test.ts). Здесь —
 * то, что видно только в собранном поле и что чаще всего бесит в масках:
 *
 *   1. BACKSPACE ПО РАЗДЕЛИТЕЛЮ. В «(701) 234-56-78» больше половины символов
 *      — скобки, пробелы и дефисы. Если каретка стоит за разделителем, система
 *      отдаёт компоненту строку, в которой ЦИФРЫ НЕ ИЗМЕНИЛИСЬ. Наивная маска
 *      перерисовывает то же самое, и нажатие просто ничего не делает: гость
 *      жмёт стирание, а номер стоит на месте. Проверяется и удаление в конце, и
 *      удаление в середине строки.
 *
 *   2. ВСТАВКА ПЕРЕКЛЮЧАЕТ СЕЛЕКТОР. Наружу должен уйти корректный E.164 (это
 *      покрыто разбором), но кнопка страны обязана показать флаг и код той
 *      страны, чей номер теперь в поле. Поле, которое отдаёт «+1…», а рисует
 *      «+7», врёт гостю о том, куда уйдёт код.
 *
 *   3. ПУСТОЕ ПОЛЕ НЕ ОТДАЁТ «+7». Один код страны — не номер.
 *
 * Компонент монтируется напрямую: экраны входа и брони — маршруты
 * expo-router и в jsdom не поднимаются (TESTING.md). react-native-web рендерит
 * `accessibilityLabel` как `aria-label`, поэтому и поле, и кнопку страны
 * находим так же, как их нашёл бы скринридер.
 */

/** Обёртка-родитель: поле не полностью контролируемое, а состояние экрана
 * хранит E.164 — ровно так им пользуются вход и форма брони. */
function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const [complete, setComplete] = useState(false);
  return (
    <>
      <PhoneField
        label="Номер телефона"
        value={value}
        onChange={(next) => {
          setValue(next.e164);
          setComplete(next.complete);
        }}
      />
      <output data-testid="e164">{value}</output>
      <output data-testid="complete">{complete ? "yes" : "no"}</output>
    </>
  );
}

function input(): HTMLInputElement {
  return screen.getByLabelText("Номер телефона") as HTMLInputElement;
}

function emitted(): string {
  return screen.getByTestId("e164").textContent ?? "";
}

function countryButton(): HTMLElement {
  return screen.getByRole("button", { name: /Открыть список$/ });
}

/** `toHaveAccessibleName` живёт в jest-dom, а он в этом репозитории только
 * транзитивная зависимость и опираться на неё нельзя (TESTING.md). Читаем
 * атрибут напрямую — это ровно то, что видит скринридер. */
function countryLabel(): string {
  return countryButton().getAttribute("aria-label") ?? "";
}

describe("поле телефона", () => {
  it("стирание разделителя в конце убирает цифру, а не молчит", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "7012345678" } });
    expect(input().value).toBe("(701) 234-56-78");

    // Обычное стирание цифры с конца работает и без всяких хитростей.
    fireEvent.change(input(), { target: { value: "(701) 234-56-7" } });
    expect(input().value).toBe("(701) 234-56-7");

    // А вот случай, ради которого написан этот тест. Гость дошёл стиранием до
    // «(701)» — последний символ теперь ЗАКРЫВАЮЩАЯ СКОБКА. Система отдаёт
    // «(701», цифры «701» не изменились, и наивная маска нарисует «(701)»
    // обратно: гость жмёт стирание, а поле стоит.
    fireEvent.change(input(), { target: { value: "701" } });
    expect(input().value).toBe("(701)");
    fireEvent.change(input(), { target: { value: "(701" } });
    expect(input().value).toBe("(70");
    expect(emitted()).toBe("+770");
  });

  it("стирание разделителя в середине убирает цифру перед ним, а не последнюю", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "7012345678" } });

    // Гость поставил каретку после «)» в «(701) 234-56-78» и стёр скобку.
    // Цифры не изменились; убрать нужно «1» — цифру перед разделителем, —
    // а не «8» в самом конце.
    fireEvent.change(input(), { target: { value: "(701 234-56-78" } });
    expect(emitted()).toBe("+7702345678");
    expect(input().value).toBe("(702) 345-67-8");
  });

  it("вставка иностранного номера переключает и селектор страны, и значение", () => {
    render(<Harness />);
    expect(countryLabel()).toBe("Код страны: Казахстан, +7. Открыть список");

    fireEvent.change(input(), { target: { value: "+1 212 555 1234" } });

    expect(countryLabel()).toBe("Код страны: США, +1. Открыть список");
    expect(input().value).toBe("(212) 555-1234");
    expect(emitted()).toBe("+12125551234");
    expect(screen.getByTestId("complete").textContent).toBe("yes");
  });

  it("предзаполнение из аккаунта показывает номер под форматом ЕГО страны", () => {
    render(<Harness initial="+12125551234" />);
    expect(countryLabel()).toBe("Код страны: США, +1. Открыть список");
    expect(input().value).toBe("(212) 555-1234");
  });

  it("пустое поле отдаёт пустую строку, а не один код страны", () => {
    render(<Harness />);
    expect(emitted()).toBe("");
    fireEvent.change(input(), { target: { value: "701" } });
    expect(emitted()).toBe("+7701");
    fireEvent.change(input(), { target: { value: "" } });
    expect(emitted()).toBe("");
    expect(screen.getByTestId("complete").textContent).toBe("no");
  });

  it("выделить всё и напечатать одну цифру — поле не держится за старый номер", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "7012345678" } });
    fireEvent.change(input(), { target: { value: "5" } });
    expect(input().value).toBe("(5");
    expect(emitted()).toBe("+75");
  });

  it("список стран открывается с кнопки и меняет код, сохраняя набранные цифры", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "2125551234" } });
    expect(countryLabel()).toBe("Код страны: Казахстан, +7. Открыть список");

    fireEvent.click(countryButton());
    fireEvent.click(screen.getByRole("button", { name: "Код страны: США, +1" }));

    expect(countryLabel()).toBe("Код страны: США, +1. Открыть список");
    // Цифры остались: исправление страны не должно стоить гостю перенабора.
    expect(input().value).toBe("(212) 555-1234");
    expect(emitted()).toBe("+12125551234");
  });
});
