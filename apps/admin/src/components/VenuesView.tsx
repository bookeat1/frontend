"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  activeVenueFeatures,
  cuisineIdsOf,
  mergeVenueFeatureOptions,
  parseSocialLinkRows,
  sameCuisineSelection,
  sameVenueFeatureSelection,
  saveVenueWithDictionaries,
  venueFeatureIdsOf,
  type CatalogVenue,
  type CatalogVenueInput,
  type CityDictionaryEntry,
  type CuisineDictionaryEntry,
  type VenueFeatureDictionaryEntry,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useCityDictionary } from "@/lib/use-cities";
import { useCuisineDictionary } from "@/lib/use-cuisines";
import { useVenueFeatureDictionary } from "@/lib/use-venue-features";
import { useIsPlatformAdmin, useVenueCatalog, useVenueMutations } from "@/lib/use-venue-catalog";
import {
  EMPTY_VENUE_FILTERS,
  collectCityOptions,
  collectCuisineOptions,
  collectFeatureOptions,
  filterVenues,
  hasActiveVenueFilters,
  type VenueFilters,
} from "@/lib/venue-filters";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { VenueFilterBar } from "./VenueFilterBar";
import { Button } from "./ui/Button";
import { Field, TextArea, TextInput } from "./ui/FormControls";
import { CitySelectField, cityOptionsFor } from "./ui/CitySelectField";
import { CuisinePicker, mergeCuisineOptions } from "./ui/CuisinePicker";
import { VenueFeaturePicker } from "./ui/VenueFeaturePicker";
import { ImageUploadField } from "./ui/ImageUploadField";
import { Modal } from "./ui/Modal";
import {
  SOCIAL_LINK_ERROR_COPY,
  SocialLinksField,
  draftsFromLinks,
  type SocialLinkDraft,
} from "./ui/SocialLinksField";

/** Ступени среднего чека, как их понимает каталог. Пустая — «не выбрано». */
const PRICE_TIERS = ["", "₸", "₸₸", "₸₸₸"] as const;

/**
 * «Заведения» — каталог глазами платформы: единственное место, где заведение
 * можно завести, отредактировать, скрыть и вернуть.
 *
 * Почему отдельный раздел, а не «Настройки»: остальная панель работает внутри
 * ОДНОГО выбранного заведения (брони, меню, расписание этого заведения), а
 * здесь список всех сразу, включая скрытые. Поэтому и гейт другой —
 * администратор платформы, как у «Платформы».
 *
 * «Скрыть» — не удаление: сервер снимает флаг активности, заведение исчезает из
 * приложения, но его брони, отзывы и меню остаются на месте. Поэтому в списке
 * скрытые видны и их можно вернуть одной кнопкой; физического удаления в API
 * нет намеренно — оно оставило бы висеть чужие брони.
 */
export function VenuesView() {
  const isAdmin = useIsPlatformAdmin();
  const [filters, setFilters] = useState<VenueFilters>(EMPTY_VENUE_FILTERS);
  const [editing, setEditing] = useState<CatalogVenue | null>(null);
  const [creating, setCreating] = useState(false);

  // Что умеет сервер, уходит на сервер: название и город. Кухни и признака
  // «скрыто» у эндпоинта нет — они отбираются здесь, из уже загруженной
  // страницы каталога (per_page=100 при сегодняшних 45 заведениях).
  const query = useVenueCatalog(filters.search.trim(), filters.city);
  const { create, update, setActive, setCuisines, setFeatures } = useVenueMutations();

  // Справочник кухонь. Ручки может ещё не быть (сервер не выложен) — тогда
  // запрос ответит ошибкой, сюда приедет пустой список, фильтр откатится на
  // тексты из данных, а форма честно скажет, что справочник пуст.
  const cuisineDictionary = useCuisineDictionary();
  const dictionary = useMemo(() => cuisineDictionary.data ?? [], [cuisineDictionary.data]);

  // Справочник удобств. Тот же публичный роут и та же страховка: не ответил —
  // фильтру просто нечего показывать, а форма честно говорит, что справочник
  // пуст. Свободного ввода удобств больше нет вовсе — сервер отвергает его 422.
  const featureDictionaryQuery = useVenueFeatureDictionary();
  const featureDictionary = useMemo(
    () => featureDictionaryQuery.data ?? [],
    [featureDictionaryQuery.data],
  );

  // Справочник городов. Читается тем же публичным роутом (`GET /cities`, но с
  // `?format=full`) и с той же страховкой: не ответил — фильтр собирает города
  // из данных каталога, а форма заведения откатывается на ввод текстом.
  const cityDictionaryQuery = useCityDictionary();
  const cityDictionary = useMemo(
    () => cityDictionaryQuery.data ?? [],
    [cityDictionaryQuery.data],
  );

  // Списки для выпадающих собираются из НЕотфильтрованного каталога: иначе
  // выбор города схлопнул бы список городов до одного выбранного, и снять
  // фильтр было бы нечем. Тот же ключ запроса, что и выше, когда фильтров нет,
  // — react-query отдаёт один и тот же результат, а не второй запрос.
  const optionsQuery = useVenueCatalog("", "");
  const allVenues = useMemo(() => optionsQuery.data?.items ?? [], [optionsQuery.data]);
  const cityOptions = useMemo(
    () => collectCityOptions(allVenues, cityDictionary),
    [allVenues, cityDictionary],
  );
  const cuisineOptions = useMemo(
    () => collectCuisineOptions(allVenues, dictionary),
    [allVenues, dictionary],
  );
  const featureOptions = useMemo(
    () => collectFeatureOptions(featureDictionary),
    [featureDictionary],
  );

  const loaded = useMemo(() => query.data?.items ?? [], [query.data]);
  // Серверный отбор повторяется здесь один в один (те же правила), поэтому
  // повторное применение ничего не отсекает сверх положенного, но избавляет от
  // зависимости «а точно ли сервер уже отфильтровал».
  const venues = useMemo(() => filterVenues(loaded, filters), [loaded, filters]);
  const filtersActive = hasActiveVenueFilters(filters);

  // Две записи вместо одной: поля заведения уходят обычным PATCH/POST, а набор
  // кухонь — отдельной ручкой PUT /restaurants/:id/cuisines. Порядок и разбор
  // «что легло, а что нет» живут в saveVenueWithCuisines, здесь только сами
  // шаги.
  const saveVenue = (input: CatalogVenueInput, id: string | null) =>
    id ? update.mutateAsync({ id, input }) : create.mutateAsync(input);
  const saveCuisines = (id: string, ids: readonly string[]) =>
    setCuisines.mutateAsync({ restaurantId: id, ids });
  const saveFeatures = (id: string, ids: readonly string[]) =>
    setFeatures.mutateAsync({ restaurantId: id, ids });

  if (!isAdmin) {
    return (
      <EmptyState
        title="Раздел только для администраторов платформы"
        description="Заведения заводит и правит платформа. Данные вашего заведения — в разделе «Настройки»."
      />
    );
  }

  return (
    <div className="p-md md:p-lg">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-xl font-semibold text-neutral-900">Заведения</h1>
        <Button onClick={() => setCreating(true)}>Добавить заведение</Button>
      </div>

      <VenueFilterBar
        filters={filters}
        onChange={setFilters}
        cityOptions={cityOptions}
        cuisineOptions={cuisineOptions}
        featureOptions={featureOptions}
        shown={venues.length}
        total={allVenues.length || loaded.length}
      />

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message="Список не загрузился" onRetry={() => void query.refetch()} />
      ) : venues.length === 0 ? (
        <EmptyState
          title={filtersActive ? "Ничего не нашлось" : "Заведений пока нет"}
          description={
            filtersActive
              ? "Под выбранные фильтры не подходит ни одно заведение. Снимите лишние — кнопка «Сбросить фильтры» выше."
              : "Добавьте первое заведение — оно сразу появится в приложении."
          }
        />
      ) : (
        <div className="mt-md overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Заведение</th>
                <th className="px-4 py-2 font-medium">Кухня</th>
                <th className="px-4 py-2 font-medium">Город</th>
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr key={venue.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{venue.name}</div>
                    {venue.address ? (
                      <div className="text-[12px] text-neutral-500">{venue.address}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{venue.cuisine_type || "—"}</td>
                  <td className="px-4 py-3 text-neutral-700">{venue.city || "—"}</td>
                  <td className="px-4 py-3">
                    {venue.is_active ? (
                      <span className="text-neutral-700">Активный</span>
                    ) : (
                      <span className="text-neutral-400">Скрытый</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-xs">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(venue)}>
                        Изменить
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={setActive.isPending && setActive.variables?.id === venue.id}
                        onClick={() =>
                          setActive.mutate({ id: venue.id, active: !venue.is_active })
                        }
                      >
                        {venue.is_active ? "Скрыть" : "Вернуть"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {setActive.isError ? (
        <p className="mt-md text-sm text-brand">
          Не удалось изменить видимость. Попробуйте ещё раз.
        </p>
      ) : null}

      {creating ? (
        <VenueFormModal
          title="Новое заведение"
          dictionary={dictionary}
          featureDictionary={featureDictionary}
          cityDictionary={cityDictionary}
          cityDictionaryLoading={cityDictionaryQuery.isPending}
          cityDictionaryFailed={cityDictionaryQuery.isError}
          saveVenue={saveVenue}
          saveCuisines={saveCuisines}
          saveFeatures={saveFeatures}
          onClose={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <VenueFormModal
          title={editing.name}
          venue={editing}
          dictionary={dictionary}
          featureDictionary={featureDictionary}
          cityDictionary={cityDictionary}
          cityDictionaryLoading={cityDictionaryQuery.isPending}
          cityDictionaryFailed={cityDictionaryQuery.isError}
          saveVenue={saveVenue}
          saveCuisines={saveCuisines}
          saveFeatures={saveFeatures}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Форма заведения — она же для создания и для правки. Пустые поля НЕ уходят на
 * сервер при правке: PATCH принимает только присланные ключи, поэтому очистка
 * поля и «не трогал поле» должны различаться. Здесь отправляется то, что
 * реально изменилось.
 *
 * ДВЕ ЗАПИСИ ВМЕСТО ОДНОЙ. Кухни сервер пишет отдельной ручкой
 * (PUT /restaurants/:id/cuisines), поэтому «Сохранить» это две записи подряд, а
 * не одна. Что из этого следует для человека:
 *   • сперва заведение, потом кухни — у нового заведения id появляется только
 *     из ответа на создание, а строку `cuisine_type` для старых клиентов сервер
 *     пересобирает именно при записи набора, так что набор обязан лечь
 *     последним;
 *   • если не легло заведение — кухни даже не пробуем: писать их некуда;
 *   • если легло заведение, а кухни нет — форма НЕ закрывается и прямо говорит,
 *     что сохранилось, а что нет, и даёт повторить только кухни;
 *   • повторное «Сохранить» после уже созданного заведения не создаёт второе —
 *     оно правит созданное (id запомнен).
 */
function VenueFormModal({
  title,
  venue,
  dictionary,
  featureDictionary,
  cityDictionary,
  cityDictionaryLoading = false,
  cityDictionaryFailed = false,
  saveVenue,
  saveCuisines,
  saveFeatures,
  onClose,
  onSaved,
}: {
  title: string;
  venue?: CatalogVenue;
  dictionary: readonly CuisineDictionaryEntry[];
  featureDictionary: readonly VenueFeatureDictionaryEntry[];
  cityDictionary: readonly CityDictionaryEntry[];
  cityDictionaryLoading?: boolean;
  cityDictionaryFailed?: boolean;
  saveVenue: (input: CatalogVenueInput, id: string | null) => Promise<CatalogVenue>;
  saveCuisines: (id: string, ids: readonly string[]) => Promise<unknown>;
  saveFeatures: (id: string, ids: readonly string[]) => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(venue?.name ?? "");
  const [description, setDescription] = useState(venue?.description ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  // Пусто у нового заведения — и это намеренно: подставленный по умолчанию
  // город тем и опасен, что его не замечают и сохраняют не глядя. Первый город
  // справочника подставляется ниже, только когда справочник уже ответил.
  const [city, setCity] = useState(venue?.city ?? "");
  const [phone, setPhone] = useState(venue?.phone ?? "");
  const [email, setEmail] = useState(venue?.email ?? "");
  const [priceCategory, setPriceCategory] = useState(venue?.price_category ?? "");
  const [priceMin, setPriceMin] = useState(
    venue?.price_range?.min != null ? String(venue.price_range.min) : "",
  );
  const [priceMax, setPriceMax] = useState(
    venue?.price_range?.max != null ? String(venue.price_range.max) : "",
  );
  const [photo, setPhoto] = useState(venue?.primary_image ?? "");
  const [socialRows, setSocialRows] = useState<SocialLinkDraft[]>([]);
  const [socialError, setSocialError] = useState<{ index: number; message: string } | null>(null);

  // Набор кухонь заведения. Как и ссылки на соцсети, он ЗАМЕЩАЕТСЯ целиком,
  // поэтому отправлять его можно только прочитав текущий: сохранить вслепую =
  // стереть кухни, которых форма не показывала.
  const [cuisineIds, setCuisineIds] = useState<string[]>([]);
  const [loadedCuisineIds, setLoadedCuisineIds] = useState<string[] | null>(venue ? null : []);
  const [venueCuisines, setVenueCuisines] = useState<CatalogVenue["cuisines"]>(venue?.cuisines);

  // Набор удобств — ровно та же история: PUT /restaurants/:id/features
  // замещает его целиком, поэтому отправлять его можно только прочитав
  // текущий. Свободнотекстовая запись удобств в теле PATCH заведения теперь
  // отвергается сервером с 422, так что другого пути и нет.
  const [featureIds, setFeatureIds] = useState<string[]>([]);
  const [loadedFeatureIds, setLoadedFeatureIds] = useState<string[] | null>(venue ? null : []);
  const [venueFeatures, setVenueFeatures] = useState<CatalogVenue["features"]>(venue?.features);

  // Состояние сохранения. Две записи — три исхода, и «заведение сохранили, а
  // кухни нет» это отдельный, со своей кнопкой.
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<null | "venue" | "cuisines" | "features">(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Ссылки на соцсети приходят ТОЛЬКО в детальном ответе: листинг каталога
  // (GET /admin/restaurants) их не отдаёт вообще. Поэтому при правке они
  // догружаются отдельным запросом — и пока он не ответил, ключ social_links в
  // PATCH не уходит: он замещает набор целиком, и отправить его вслепую значит
  // стереть заведению все ссылки.
  const socialQuery = useQuery({
    queryKey: ["venue-social-links", venue?.id ?? null],
    queryFn: () => apiClient.getRestaurantSocialLinks(venue!.id),
    enabled: Boolean(venue?.id),
  });
  const socialLoaded = venue ? socialQuery.isSuccess : true;

  // Кухни заведения читаются своей ручкой, а не из строки листинга: в листинге
  // набор есть (listItemToResponse кладёт `cuisines`), но на сборке без
  // справочника его нет ни у кого, и отличить «нет кухонь» от «нет ручки» по
  // листингу нельзя. Отдельный запрос отвечает на это однозначно.
  const cuisineQuery = useQuery({
    queryKey: ["venue-cuisines", venue?.id ?? null],
    queryFn: () => apiClient.getRestaurantCuisines(venue!.id),
    enabled: Boolean(venue?.id),
    retry: false,
  });

  // Удобства заведения читаются своей ручкой по той же причине, что и кухни:
  // в листинге набор есть, но отличить «удобств нет» от «ручка не ответила» по
  // нему нельзя, а PUT замещает набор целиком.
  const featureQuery = useQuery({
    queryKey: ["venue-feature-set", venue?.id ?? null],
    queryFn: () => apiClient.getRestaurantFeatures(venue!.id),
    enabled: Boolean(venue?.id),
    retry: false,
  });

  // Город нового заведения: первый активный город справочника, и ТОЛЬКО когда
  // справочник уже ответил. Раньше здесь была зашитая «Алматы» — ровно та
  // подстановка, которую не видно и сохраняют не глядя. Условие `!city`
  // означает, что человек ещё ничего не выбирал: как только выбрал, эффект
  // больше не срабатывает и выбор не перетирается.
  useEffect(() => {
    if (venue || city) return;
    // Ровно тот же список и тот же порядок, что покажет сам select, — иначе
    // «по умолчанию» и «первый в списке» разъехались бы.
    const first = cityOptionsFor(cityDictionary, "")[0];
    if (first) setCity(first.value);
  }, [venue, city, cityDictionary]);

  useEffect(() => {
    if (socialQuery.data) setSocialRows(draftsFromLinks(socialQuery.data));
  }, [socialQuery.data]);

  useEffect(() => {
    if (!cuisineQuery.data) return;
    const ids = cuisineIdsOf(cuisineQuery.data);
    setLoadedCuisineIds(ids);
    setCuisineIds(ids);
    setVenueCuisines(cuisineQuery.data);
  }, [cuisineQuery.data]);

  useEffect(() => {
    if (!featureQuery.data) return;
    const ids = venueFeatureIdsOf(featureQuery.data);
    setLoadedFeatureIds(ids);
    setFeatureIds(ids);
    setVenueFeatures(featureQuery.data);
  }, [featureQuery.data]);

  const cuisineOptions = useMemo(
    () => mergeCuisineOptions(dictionary, venueCuisines ?? []),
    [dictionary, venueCuisines],
  );
  const featureOptions = useMemo(
    () => mergeVenueFeatureOptions(activeVenueFeatures(featureDictionary), venueFeatures ?? []),
    [featureDictionary, venueFeatures],
  );
  const cuisinesLoaded = loadedCuisineIds !== null;
  const cuisinesChanged = cuisinesLoaded && !sameCuisineSelection(cuisineIds, loadedCuisineIds!);
  const featuresLoaded = loadedFeatureIds !== null;
  const featuresChanged =
    featuresLoaded && !sameVenueFeatureSelection(featureIds, loadedFeatureIds!);

  const canSubmit = name.trim().length > 0 && !busy;

  const buildInput = (): CatalogVenueInput | null => {
    const input: CatalogVenueInput = {
      name: name.trim(),
      description: description.trim(),
      address: address.trim(),
      city: city.trim(),
      phone: phone.trim(),
      email: email.trim(),
      price_category: priceCategory,
    };
    // Диапазон чека — либо обе границы, либо ни одной: половина диапазона в
    // карточке заведения выглядит как «от 6000 до нуля».
    const min = Number.parseInt(priceMin, 10);
    const max = Number.parseInt(priceMax, 10);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      input.price_min = min;
      input.price_max = max;
    }
    // Фото отправляем ТОЛЬКО когда оно есть: пустой массив стёр бы всю галерею
    // заведения, а не «оставил как было».
    if (photo.trim()) {
      input.images = [{ image_url: photo.trim(), is_primary: true }];
    }
    // Соцсети: пустые строки отбрасываются, ник превращается в ссылку, две
    // ссылки одного вида не проходят (см. parseSocialLinkRows).
    const social = parseSocialLinkRows(socialRows);
    if (!social.ok) {
      setSocialError({ index: social.index, message: SOCIAL_LINK_ERROR_COPY[social.error] });
      return null;
    }
    setSocialError(null);
    if (socialLoaded) {
      input.social_links = social.links;
    }
    // `cuisine_type` больше не поле формы: сервер собирает его сам из набора
    // кухонь, и прислать его отдельно значило бы завести девятнадцатое
    // написание кухни в каталоге.
    return input;
  };

  const submit = async () => {
    if (!canSubmit) return;
    const input = buildInput();
    if (!input) return;

    setBusy(true);
    setFailure(null);
    const targetId = venue?.id ?? createdId;
    const outcome = await saveVenueWithDictionaries({
      saveVenue: () => saveVenue(input, targetId),
      // null = набор не трогаем: он либо не прочитан, либо не менялся.
      cuisineIds: cuisinesChanged ? cuisineIds : null,
      saveCuisines,
      featureIds: featuresChanged ? featureIds : null,
      saveFeatures,
    });
    setBusy(false);

    if (outcome.status === "venue_failed") {
      setFailure("venue");
      return;
    }
    if (outcome.status === "cuisines_failed") {
      setCreatedId(outcome.venue.id);
      setFailure("cuisines");
      return;
    }
    if (outcome.status === "features_failed") {
      setCreatedId(outcome.venue.id);
      setFailure("features");
      return;
    }
    onSaved();
  };

  /** Повтор ТОЛЬКО кухонь: заведение уже сохранено, второй раз его писать
   * незачем. Удобства после удавшихся кухонь всё-таки дописываются — иначе
   * повтор оставил бы вторую половину набора несохранённой и молча. */
  const retryCuisines = async () => {
    const targetId = venue?.id ?? createdId;
    if (!targetId) return;
    setBusy(true);
    try {
      await saveCuisines(targetId, cuisineIds);
    } catch {
      setBusy(false);
      setFailure("cuisines");
      return;
    }
    if (featuresChanged) {
      try {
        await saveFeatures(targetId, featureIds);
      } catch {
        setBusy(false);
        setFailure("features");
        return;
      }
    }
    setFailure(null);
    setBusy(false);
    onSaved();
  };

  /** Повтор ТОЛЬКО удобств: и заведение, и кухни уже легли. */
  const retryFeatures = async () => {
    const targetId = venue?.id ?? createdId;
    if (!targetId) return;
    setBusy(true);
    try {
      await saveFeatures(targetId, featureIds);
      setFailure(null);
      setBusy(false);
      onSaved();
    } catch {
      setBusy(false);
      setFailure("features");
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-md">
        <Field label="Название" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Описание">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>

        <CitySelectField
          dictionary={cityDictionary}
          loading={cityDictionaryLoading}
          failed={cityDictionaryFailed}
          value={city}
          onChange={setCity}
          disabled={busy}
        />

        {venue && cuisineQuery.isPending ? (
          <p className="text-sm text-text-muted" role="status">
            {t.admin.venueCuisines.loadingTitle}
          </p>
        ) : venue && cuisineQuery.isError ? (
          <p className="text-sm text-brand" role="alert">
            {t.admin.venueCuisines.loadFailed}
          </p>
        ) : (
          <CuisinePicker
            options={cuisineOptions}
            selected={cuisineIds}
            onChange={setCuisineIds}
            disabled={busy}
          />
        )}

        {venue && featureQuery.isPending ? (
          <p className="text-sm text-text-muted" role="status">
            {t.admin.venueFeatures.loadingTitle}
          </p>
        ) : venue && featureQuery.isError ? (
          <p className="text-sm text-brand" role="alert">
            {t.admin.venueFeatures.loadFailed}
          </p>
        ) : (
          <VenueFeaturePicker
            options={featureOptions}
            selected={featureIds}
            onChange={setFeatureIds}
            disabled={busy}
            idPrefix="venue-form-feature"
          />
        )}

        <Field label="Адрес">
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>

        <div className="grid gap-md sm:grid-cols-2">
          <Field label="Телефон">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Почта">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-md sm:grid-cols-3">
          <Field label="Ступень цены">
            <select
              className="min-h-[44px] w-full rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
              value={priceCategory}
              onChange={(e) => setPriceCategory(e.target.value)}
            >
              {PRICE_TIERS.map((tier) => (
                <option key={tier || "none"} value={tier}>
                  {tier || "Не выбрано"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Чек от, ₸">
            <TextInput
              inputMode="numeric"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
            />
          </Field>
          <Field label="Чек до, ₸">
            <TextInput
              inputMode="numeric"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </Field>
        </div>

        <ImageUploadField
          value={photo}
          onChange={setPhoto}
          label="Главное фото"
          hint="Оно показывается в каталоге и на карточке заведения."
        />

        {venue && socialQuery.isPending ? (
          <p className="text-sm text-text-muted" role="status">
            {t.admin.socialLinks.loadingTitle}
          </p>
        ) : venue && socialQuery.isError ? (
          <p className="text-sm text-brand" role="alert">
            {t.admin.socialLinks.loadFailed}
          </p>
        ) : (
          <SocialLinksField
            rows={socialRows}
            onChange={(next) => {
              setSocialRows(next);
              setSocialError(null);
            }}
            disabled={busy}
            errorIndex={socialError?.index ?? null}
            errorMessage={socialError?.message ?? null}
            idPrefix="venue-social"
          />
        )}

        {failure === "venue" ? (
          <p className="text-sm text-brand" role="alert">
            Не удалось сохранить. Проверьте поля и попробуйте ещё раз.
          </p>
        ) : null}

        {failure === "cuisines" ? (
          <div className="flex flex-col gap-xs" role="alert">
            <p className="text-sm text-brand">
              Заведение сохранили, а кухни — нет. Всё остальное уже на месте: повторите только
              кухни или закройте форму и вернитесь к ним позже.
            </p>
            <div>
              <Button variant="secondary" size="sm" loading={busy} onClick={() => void retryCuisines()}>
                Повторить кухни
              </Button>
            </div>
          </div>
        ) : null}

        {failure === "features" ? (
          <div className="flex flex-col gap-xs" role="alert">
            <p className="text-sm text-brand">
              Заведение сохранили, а удобства — нет. Всё остальное уже на месте: повторите
              только удобства или закройте форму и вернитесь к ним позже.
            </p>
            <div>
              <Button
                variant="secondary"
                size="sm"
                loading={busy}
                onClick={() => void retryFeatures()}
              >
                Повторить удобства
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-xs">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!canSubmit}>
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
