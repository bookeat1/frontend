"use client";

import type { GuideCollectionDetail } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

const copy = t.admin.gastroguide;

/**
 * What a guest would actually see.
 *
 * The preview applies the SAME two rules the server's guest read applies, and
 * nothing else — inventing a third would make it a lie:
 *
 *   1. Only active venues appear (the guest query filters on restaurants.
 *      is_active), in the editor's order.
 *   2. A collection that is not published is not visible at all, whatever it
 *      looks like here. That is said in words rather than by rendering nothing,
 *      because a blank preview reads as "broken".
 *
 * It is not a pixel copy of the app screen and does not pretend to be. Its job
 * is to answer the one question the editor keeps asking — "почему в приложении
 * не то, что у меня в кабинете" — and the answer is almost always a deactivated
 * venue or an unpublished draft.
 */
export function GuideGuestPreview({ collection }: { collection: GuideCollectionDetail }) {
  const visible = collection.venues.filter((v) => v.is_active);
  const notLive =
    collection.status !== "published" ||
    (!!collection.published_at && new Date(collection.published_at).getTime() > Date.now());

  return (
    <section className="flex flex-col gap-md rounded-card bg-surface p-lg">
      <div>
        <h2 className="text-base font-semibold text-text">{copy.previewTitle}</h2>
        <p className="mt-xxs break-words text-[13px] text-text-muted">{copy.previewHint}</p>
      </div>

      {notLive ? (
        <p className="rounded-card bg-amber-50 px-md py-sm text-[13px] text-amber-900">
          {copy.previewNotPublished}
        </p>
      ) : null}

      <div className="rounded-card bg-screen p-lg">
        {collection.cover_image_url ? (
          // The cover is an arbitrary external URL the editor pasted, and the
          // panel is built with output: "export" — next/image's default loader
          // needs a server, and its allow-list needs the host at build time.
          // A plain <img> is the honest element here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={collection.cover_image_url}
            alt=""
            className="mb-md h-32 w-full rounded-card object-cover"
          />
        ) : null}
        <p className="break-words text-base font-bold text-text">{collection.title}</p>
        {collection.subtitle ? (
          <p className="mt-xxs break-words text-sm text-text-muted">{collection.subtitle}</p>
        ) : null}
        {collection.description ? (
          <p className="mt-sm break-words text-[13px] leading-snug text-text">
            {collection.description}
          </p>
        ) : null}

        {visible.length === 0 ? (
          <p className="mt-md rounded-card bg-rose-50 px-md py-sm text-[13px] text-rose-700">
            {copy.previewEmpty}
          </p>
        ) : (
          <ol className="mt-md flex flex-col gap-sm">
            {visible.map((v, i) => (
              <li key={v.restaurant_id} className="flex gap-md rounded-card bg-surface p-md">
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-chip text-[12px] font-semibold text-text-muted"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-text">{v.name}</p>
                  <p className="break-words text-[13px] text-text-muted">
                    {[v.city, v.cuisine_type].filter(Boolean).join(" · ")}
                  </p>
                  {v.note ? (
                    <p className="mt-xxs break-words text-[13px] text-text">{v.note}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
