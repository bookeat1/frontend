"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseSocialLinkRows, type SocialLink, type SocialLinkInput } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useOptionalAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { isVenueUnavailableError } from "@/lib/venue-access";
import { Button } from "./ui/Button";
import {
  SOCIAL_LINK_ERROR_COPY,
  SocialLinksField,
  draftsFromLinks,
  type SocialLinkDraft,
} from "./ui/SocialLinksField";
import { ErrorState, LoadingState, VenueUnavailableState } from "./StateViews";

/**
 * «Соцсети» в настройках заведения — чтобы ресторан правил свои ссылки сам.
 *
 * Права: пишет тот же `PATCH /restaurants/:id`, что и «Средний чек». Роут
 * смонтирован на группе `RequireRestaurantManager` (bootstrap/app.go), а
 * `social_links`, в отличие от `is_active` и маркетинговых флагов, для
 * не-админа НЕ вырезается — управляющий заведения правит свои ссылки без
 * суперадмина.
 *
 * Набор ссылок сервер ЗАМЕЩАЕТ целиком, поэтому карточка сначала читает
 * текущий набор и только потом даёт сохранять: сохранить, не зная, что там
 * лежало, значит стереть чужое.
 */
const copy = t.admin.socialLinks;

export interface SocialLinksClient {
  getRestaurantSocialLinks(restaurantId: string): Promise<SocialLink[]>;
  setRestaurantSocialLinks(restaurantId: string, links: SocialLinkInput[]): Promise<SocialLink[]>;
}

export function SocialLinksCard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: SocialLinksClient;
}) {
  const queryClient = useQueryClient();
  const auth = useOptionalAuth();
  const queryKey = useMemo(() => ["restaurant-social-links", restaurantId] as const, [restaurantId]);

  const query = useQuery({
    queryKey,
    queryFn: () => client.getRestaurantSocialLinks(restaurantId),
  });

  if (query.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (query.isError) {
    // 404/403 on the venue is not a connection problem: the venue is hidden
    // from the catalog (the read goes through the public venue endpoint, which
    // does not serve deactivated venues) or is no longer this person's. Saying
    // «проверьте соединение» there sends people looking for a network fault
    // that does not exist.
    if (isVenueUnavailableError(query.error)) {
      return (
        <VenueUnavailableState
          onPickAnother={auth ? () => auth.clearRestaurant() : undefined}
        />
      );
    }
    return <ErrorState message={copy.loadFailed} onRetry={() => void query.refetch()} />;
  }

  return (
    <SocialLinksForm
      restaurantId={restaurantId}
      client={client}
      links={query.data}
      onChanged={() => queryClient.invalidateQueries({ queryKey })}
    />
  );
}

function SocialLinksForm({
  restaurantId,
  client,
  links,
  onChanged,
}: {
  restaurantId: string;
  client: SocialLinksClient;
  links: SocialLink[];
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<SocialLinkDraft[]>(() => draftsFromLinks(links));
  const [rowError, setRowError] = useState<{ index: number; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Правда — на сервере: после сохранения в полях оказывается приведённый им
  // набор (в том числе ссылка, которую мы собрали из ника), а не набранное.
  //
  // Сверка с УЖЕ разложенным набором обязательна, и вот почему. Пересборка
  // строк выдаёт им новые `key`, а новый key для React — другой элемент: он
  // сносит <li> вместе с полем и монтирует новое. Безусловный сброс на монтаже
  // делал это ровно один раз — и человек продолжал печатать в поле, которого в
  // документе уже нет. Ссылка при этом сохранялась старая, а на экране была
  // набранная: худший вид расхождения, потому что он выглядит как успех.
  // react-query отдаёт ТУ ЖЕ ссылку на данные, пока их содержимое не менялось,
  // поэтому сравнение по ссылке здесь и означает «сервер сказал что-то новое».
  const syncedRef = useRef(links);
  useEffect(() => {
    if (syncedRef.current === links) return;
    syncedRef.current = links;
    setRows(draftsFromLinks(links));
  }, [links]);

  const mutation = useMutation({
    mutationFn: (payload: SocialLinkInput[]) =>
      client.setRestaurantSocialLinks(restaurantId, payload),
    onSuccess: () => {
      setSaved(true);
      onChanged();
    },
    onError: () => {
      setSaved(false);
      setSaveError(copy.saveFailed);
    },
  });

  function submit() {
    setRowError(null);
    setSaveError(null);
    setSaved(false);
      const parsed = parseSocialLinkRows(rows);
    if (!parsed.ok) {
      setRowError({ index: parsed.index, message: SOCIAL_LINK_ERROR_COPY[parsed.error] });
      return;
    }
    mutation.mutate(parsed.links);
  }

  const busy = mutation.isPending;

  return (
    <div className="rounded-card bg-surface p-lg">
      <h2 className="text-base font-semibold text-text">{copy.title}</h2>

      <div className="mt-lg">
        <SocialLinksField
          rows={rows}
          onChange={(next) => {
            setRows(next);
            setRowError(null);
            setSaved(false);
          }}
          disabled={busy}
          errorIndex={rowError?.index ?? null}
          errorMessage={rowError?.message ?? null}
          idPrefix="settings-social"
          showTitle={false}
        />
      </div>

      <div className="mt-lg flex flex-wrap items-center gap-md">
        <Button onClick={submit} loading={busy}>
          {busy ? copy.saving : copy.save}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-text-muted">
            {copy.saved}
          </span>
        ) : null}
        {saveError ? (
          <span role="alert" className="text-sm text-brand">
            {saveError}
          </span>
        ) : null}
      </div>
    </div>
  );
}
