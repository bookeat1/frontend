import type { GeoPoint } from "@bookeat/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { trackEvent } from "../lib/analytics";
import {
  GEO_PROMPT_MAX_AUTO_SHOWS,
  markGeoPromptAnswered,
  readGeoPromptFlags,
  recordGeoPromptShown,
} from "../lib/geo/geo-prompt";
import { useGuestLocation } from "../lib/geo/guest-location";

type Phase = "checking" | "shown" | "working" | "hidden";

/**
 * Состояние пре-промпта «Показать сначала ближайшие?» над списком «Поиска»
 * (спека geolocation-permission.md, сценарии 3.1-3.5, критерии 10-14).
 *
 * Хук живёт на уровне ЭКРАНА, а не внутри карточки: карточка рисуется как
 * шапка списка и пропадает вместе со списком (загрузка, пустая выдача), а
 * решение «показывать ли» обязано приниматься ОДИН раз за визит — иначе гость
 * набрал и стёр текст, список перемонтировался, и счётчик показов вырос бы.
 *
 * Системный диалог вызывается ТОЛЬКО из `onAllow` (критерий 10).
 *
 * Карточка видна, когда ОДНОВРЕМЕННО: «Поиск» без текста (`active`), статус ОС
 * `undetermined`, на неё ещё не отвечали и показов меньше трёх. Число показов
 * растёт в момент ОТРИСОВКИ карточки (`onShown`), не ответа, поэтому игнорируемая карточка замолкает
 * после третьего визита (3.3). Любая кнопка ставит `answered`.
 *
 * `onLocated` вызывается сразу после выданного разрешения: единственный случай,
 * когда список перестраивается уже после первого запроса визита (критерий 14).
 */
export function useLocationPrompt({
  active,
  onLocated,
}: {
  active: boolean;
  onLocated: (point: GeoPoint) => void;
}): {
  visible: boolean;
  working: boolean;
  onAllow: () => void;
  onLater: () => void;
  /** Карточка отрисована: засчитать показ (счётчик и событие). */
  onShown: () => void;
} {
  const geo = useGuestLocation();
  const [phase, setPhase] = useState<Phase>("checking");
  const decided = useRef(false);
  const autoShows = useRef(0);
  const shownRecorded = useRef(false);
  // Ref, а не только `phase`: два тапа в одном кадре видят одно и то же старое
  // состояние, и без синхронного замка диалог был бы вызван дважды.
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const { permission, request } = geo;

  useEffect(() => {
    if (decided.current) return;
    if (Platform.OS === "web" || permission === "pending") return;
    decided.current = true;
    if (permission !== "undetermined") {
      setPhase("hidden");
      return;
    }
    void readGeoPromptFlags().then((flags) => {
      if (!alive.current) return;
      if (flags.answered || flags.autoShows >= GEO_PROMPT_MAX_AUTO_SHOWS) {
        setPhase("hidden");
        return;
      }
      autoShows.current = flags.autoShows;
      setPhase("shown");
    });
  }, [permission]);

  // Показ засчитывается, когда карточку РЕАЛЬНО отрисовали (её mount зовёт
  // `onShown`), а не когда принято решение «показывать»: карточка живёт в
  // шапке списка и не рисуется при загрузке, ошибке, пустой выдаче и наборе
  // текста (кр. 13). Один раз за визит.
  const onShown = useCallback(() => {
    if (shownRecorded.current) return;
    shownRecorded.current = true;
    void recordGeoPromptShown(autoShows.current);
    trackEvent("location_prompt_shown", { surface: "mobile_search_card" });
  }, []);

  const onAllow = useCallback(() => {
    // Двойной тап безвреден: пока идёт запрос, фаза `working`, второй `request()`
    // не стартует.
    if (phase !== "shown" || busy.current) return;
    busy.current = true;
    setPhase("working");
    void markGeoPromptAnswered();
    void request().then((outcome) => {
      trackEvent("location_permission_result", {
        surface: "mobile_search_card",
        result: outcome.result,
        precise: outcome.precise,
      });
      if (alive.current) setPhase("hidden");
      if (outcome.point) onLocated(outcome.point);
    });
  }, [phase, request, onLocated]);

  const onLater = useCallback(() => {
    if (phase !== "shown" || busy.current) return;
    busy.current = true;
    setPhase("hidden");
    void markGeoPromptAnswered();
    trackEvent("location_permission_result", {
      surface: "mobile_search_card",
      result: "later",
      precise: null,
    });
  }, [phase]);

  const live =
    phase === "working" || (phase === "shown" && permission === "undetermined");

  return {
    visible: Platform.OS !== "web" && active && live,
    working: phase === "working",
    onAllow,
    onLater,
    onShown,
  };
}
