import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { translationDraftFrom, type I18nMap, type TranslationDraft } from "@bookeat/api/admin";

import { TranslatedField, TranslationCoverageNote } from "../ui/TranslatedField";

/**
 * Общий редактор перевода.
 *
 * Проверяется не «рисуется ли», а три решения, каждое из которых человек
 * принимает глазами:
 *   1. вкладка «Русский» правит САМО поле, а не какой-то отдельный перевод;
 *   2. отсутствие перевода видно, НЕ открывая вкладку, и сказано словами;
 *   3. пустое поле перевода — это удаление, и об этом написано ДО сохранения.
 */

function Harness({ stored, initialBase = "Ужин" }: { stored?: I18nMap; initialBase?: string }) {
  const [base, setBase] = useState(initialBase);
  const [translations, setTranslations] = useState<TranslationDraft>(() =>
    translationDraftFrom(stored),
  );
  return (
    <>
      <TranslatedField
        id="f"
        label="Заголовок"
        base={base}
        onBaseChange={setBase}
        translations={translations}
        onTranslationsChange={setTranslations}
        stored={stored}
      />
      <output data-testid="base">{base}</output>
      <output data-testid="kk">{translations.kk}</output>
    </>
  );
}

afterEach(cleanup);

describe("TranslatedField", () => {
  it("вкладка «Русский» правит базовое поле, а не карту переводов", () => {
    render(<Harness />);
    const input = screen.getByLabelText<HTMLInputElement>(/^Заголовок/, { selector: "input" });
    expect(input.value).toBe("Ужин");

    fireEvent.change(input, { target: { value: "Ужин у моря" } });
    expect(screen.getByTestId("base").textContent).toBe("Ужин у моря");
    expect(screen.getByTestId("kk").textContent).toBe("");
  });

  it("язык без перевода помечен в самой вкладке — открывать её не нужно", () => {
    render(<Harness stored={{ en: "Dinner" }} />);
    // Доступное имя вкладки говорит то же, что видно точкой.
    expect(screen.getByRole("tab", { name: "Қазақша: перевода нет" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "English: перевод есть" })).toBeTruthy();
    expect(screen.getByText("Нет перевода: Қазақша")).toBeTruthy();
  });

  it("на вкладке без перевода сказано, что гость увидит русский текст", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: /Қазақша/ }));
    expect(
      screen.getByText(
        "Перевод не заполнен (Қазақша) — гость с этим языком увидит русский текст.",
      ),
    ).toBeTruthy();
  });

  it("очистка существующего перевода объявлена удалением ДО сохранения", () => {
    render(<Harness stored={{ kk: "Кешкі ас" }} />);
    fireEvent.click(screen.getByRole("tab", { name: /Қазақша/ }));

    const kk = screen.getByLabelText<HTMLInputElement>(/^Заголовок/, { selector: "input" });
    expect(kk.value).toBe("Кешкі ас");

    fireEvent.change(kk, { target: { value: "" } });
    expect(
      screen.getByText("Поле пустое — при сохранении перевод будет удалён (Қазақша)."),
    ).toBeTruthy();
    // Базовый русский текст при этом не тронут.
    expect(screen.getByTestId("base").textContent).toBe("Ужин");
  });

  it("перевод, которого и не было, удалением не объявляется", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: /Қазақша/ }));
    expect(screen.queryByText(/перевод будет удалён/)).toBeNull();
  });
});

describe("TranslationCoverageNote — заполненность всей формы", () => {
  it("перечисляет, каких языков и в каких полях не хватает", () => {
    render(
      <TranslationCoverageNote
        fields={[
          { label: "Заголовок", translations: { kk: "Кешкі ас", en: "" } },
          { label: "Описание", translations: { kk: "", en: "" } },
        ]}
      />,
    );
    expect(screen.getByText("Қазақша — не хватает в полях: Описание")).toBeTruthy();
    expect(screen.getByText("English — не хватает в полях: Заголовок, Описание")).toBeTruthy();
  });

  it("всё заполнено — говорит об этом, а не молчит", () => {
    render(
      <TranslationCoverageNote
        fields={[{ label: "Заголовок", translations: { kk: "Кешкі ас", en: "Dinner" } }]}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("Переводы заполнены на всех языках");
  });
});
