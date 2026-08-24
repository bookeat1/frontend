"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseSocialLinkRows, type CatalogVenue, type CatalogVenueInput } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useIsPlatformAdmin, useVenueCatalog, useVenueMutations } from "@/lib/use-venue-catalog";
import {
  EMPTY_VENUE_FILTERS,
  collectCityOptions,
  collectCuisineOptions,
  filterVenues,
  hasActiveVenueFilters,
  type VenueFilters,
} from "@/lib/venue-filters";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";
import { VenueFilterBar } from "./VenueFilterBar";
import { Button } from "./ui/Button";
import { Field, TextArea, TextInput } from "./ui/FormControls";
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
  const { create, update, setActive } = useVenueMutations();

  // Списки для выпадающих собираются из НЕотфильтрованного каталога: иначе
  // выбор города схлопнул бы список городов до одного выбранного, и снять
  // фильтр было бы нечем. Тот же ключ запроса, что и выше, когда фильтров нет,
  // — react-query отдаёт один и тот же результат, а не второй запрос.
  const optionsQuery = useVenueCatalog("", "");
  const allVenues = useMemo(() => optionsQuery.data?.items ?? [], [optionsQuery.data]);
  const cityOptions = useMemo(() => collectCityOptions(allVenues), [allVenues]);
  const cuisineOptions = useMemo(() => collectCuisineOptions(allVenues), [allVenues]);

  const loaded = useMemo(() => query.data?.items ?? [], [query.data]);
  // Серверный отбор повторяется здесь один в один (те же правила), поэтому
  // повторное применение ничего не отсекает сверх положенного, но избавляет от
  // зависимости «а точно ли сервер уже отфильтровал».
  const venues = useMemo(() => filterVenues(loaded, filters), [loaded, filters]);
  const filtersActive = hasActiveVenueFilters(filters);

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
                      <span className="text-neutral-700">Показывается</span>
                    ) : (
                      <span className="text-neutral-400">Скрыто</span>
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
          submitting={create.isPending}
          failed={create.isError}
          onClose={() => setCreating(false)}
          onSubmit={(input) =>
            create.mutate(input, { onSuccess: () => setCreating(false) })
          }
        />
      ) : null}

      {editing ? (
        <VenueFormModal
          title={editing.name}
          venue={editing}
          submitting={update.isPending}
          failed={update.isError}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            update.mutate({ id: editing.id, input }, { onSuccess: () => setEditing(null) })
          }
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
 */
function VenueFormModal({
  title,
  venue,
  submitting,
  failed,
  onClose,
  onSubmit,
}: {
  title: string;
  venue?: CatalogVenue;
  submitting: boolean;
  failed: boolean;
  onClose: () => void;
  onSubmit: (input: CatalogVenueInput) => void;
}) {
  const [name, setName] = useState(venue?.name ?? "");
  const [description, setDescription] = useState(venue?.description ?? "");
  const [cuisine, setCuisine] = useState(venue?.cuisine_type ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [city, setCity] = useState(venue?.city ?? "Алматы");
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

  useEffect(() => {
    if (socialQuery.data) setSocialRows(draftsFromLinks(socialQuery.data));
  }, [socialQuery.data]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    const input: CatalogVenueInput = {
      name: name.trim(),
      description: description.trim(),
      cuisine_type: cuisine.trim(),
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
      return;
    }
    setSocialError(null);
    if (socialLoaded) {
      input.social_links = social.links;
    }
    onSubmit(input);
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

        <div className="grid gap-md sm:grid-cols-2">
          <Field label="Кухня" hint="Например: Казахская">
            <TextInput value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
          </Field>
          <Field label="Город">
            <TextInput value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        </div>

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
            disabled={submitting}
            errorIndex={socialError?.index ?? null}
            errorMessage={socialError?.message ?? null}
            idPrefix="venue-social"
          />
        )}

        {failed ? (
          <p className="text-sm text-brand">Не удалось сохранить. Проверьте поля и попробуйте ещё раз.</p>
        ) : null}

        <div className="flex justify-end gap-xs">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} loading={submitting} disabled={!canSubmit}>
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
