"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AdminApiError, imageUploadErrorCode } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./Button";

/** Same limits the cover field enforces, for the same reason: refuse an
 * oversize or wrong-type file in the browser instead of after the upload. */
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");
/** The backend caps a gallery at 20 (usecase, migration 0070). Stopping here
 * turns a 422 into a sentence the editor can act on. */
const MAX_IMAGES = 20;

function isAcceptedType(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

function messageForError(err: unknown): string {
  const m = t.admin.imageUpload;
  if (err instanceof Error && err.message === "PRECHECK_BAD_TYPE") return m.badType;
  if (err instanceof Error && err.message === "PRECHECK_TOO_LARGE") return m.tooLarge;
  const code = err instanceof AdminApiError ? imageUploadErrorCode(err.status, err.code) : "upload_failed";
  switch (code) {
    case "image_too_large":
      return m.tooLarge;
    case "image_bad_type":
      return m.badType;
    case "image_upload_unconfigured":
      return m.unconfigured;
    case "unauthorized":
      return m.unauthorized;
    default:
      return m.failed;
  }
}

export interface ImageGalleryFieldProps {
  /** The gallery WITHOUT the cover, in the order it will be shown. */
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  hint?: string;
}

/**
 * «Ещё фотографии» — the ordered gallery an event or a promo carries beside its
 * cover (backend migration 0070). The app draws exactly this list, in exactly
 * this order, as a swipeable rail after the cover.
 *
 * Order is edited with explicit ←/→ buttons rather than drag-and-drop: the
 * order is the product ("first photo after the cover"), and a keyboard user has
 * to be able to set it too. Several files can be picked at once and upload one
 * after another, so a set of photos is one action, not five.
 */
export function ImageGalleryField({ value, onChange, label, hint }: ImageGalleryFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const g = t.admin.gallery;

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const urls: string[] = [];
      for (const file of files) {
        urls.push(await apiClient.uploadImage(file));
      }
      return urls;
    },
    // Appended, never inserted: a photo lands at the end of the rail and the
    // editor moves it where it belongs — the alternative (silently reordering
    // on upload) would fight the arrows.
    onSuccess: (urls) => {
      setError(null);
      onChange([...value, ...urls].slice(0, MAX_IMAGES));
    },
    onError: (err) => setError(messageForError(err)),
  });

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    // Reset so picking the SAME file again still fires onChange.
    e.target.value = "";
    if (picked.length === 0) return;

    const room = MAX_IMAGES - value.length;
    if (room <= 0) {
      setError(g.limitReached);
      return;
    }
    if (picked.some((f) => !isAcceptedType(f.type))) {
      setError(messageForError(new Error("PRECHECK_BAD_TYPE")));
      return;
    }
    if (picked.some((f) => f.size > MAX_BYTES)) {
      setError(messageForError(new Error("PRECHECK_TOO_LARGE")));
      return;
    }
    // More files than room: take what fits and SAY so, rather than dropping
    // the rest silently.
    if (picked.length > room) setError(g.limitReached);
    upload.mutate(picked.slice(0, room));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-xs">
      {label ? <span className="text-sm font-medium text-text">{label}</span> : null}

      {value.length === 0 ? (
        <span className="text-[12px] text-text-muted">{g.empty}</span>
      ) : (
        <ul className="flex flex-wrap gap-md">
          {value.map((url, i) => (
            <li key={`${url}-${i}`} className="flex flex-col gap-xxs">
              {/* An operator-pasted R2 URL is not a known-at-build asset, so a
                  plain <img> is the right tool here — same call the cover
                  preview makes. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={g.previewAlt(i + 1)}
                className="h-20 w-20 rounded-card border border-hairline object-cover"
              />
              <div className="flex items-center gap-xxs">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={g.moveUp(i + 1)}
                  disabled={i === 0 || upload.isPending}
                  onClick={() => move(i, i - 1)}
                >
                  ←
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={g.moveDown(i + 1)}
                  disabled={i === value.length - 1 || upload.isPending}
                  onClick={() => move(i, i + 1)}
                >
                  →
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={g.removeLabel(i + 1)}
                  disabled={upload.isPending}
                  onClick={() => {
                    setError(null);
                    onChange(value.filter((_, index) => index !== i));
                  }}
                >
                  {g.remove}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={upload.isPending}
          disabled={upload.isPending || value.length >= MAX_IMAGES}
          onClick={() => {
            setError(null);
            fileRef.current?.click();
          }}
        >
          {upload.isPending ? g.adding : g.addButton}
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFilesSelected}
      />

      {hint ? <span className="text-[12px] text-text-muted">{hint}</span> : null}

      {error ? (
        <p role="alert" className="text-sm text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}
