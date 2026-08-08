"use client";

import { useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AdminApiError, imageUploadErrorCode } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button } from "./Button";
import { TextInput } from "./FormControls";

/** Field name `file`, image/jpeg|png|webp, max 8MB — mirrors the backend's own
 * limits so an oversize/wrong-type file is refused BEFORE it leaves the browser
 * (the server enforces the same, this is just a friendlier UX). */
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

type AcceptedType = (typeof ACCEPTED_TYPES)[number];

function isAcceptedType(type: string): type is AcceptedType {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

/** Maps any upload failure to one RU line the user can act on. Client-side
 * pre-check errors already arrive as a code; server errors arrive as an
 * AdminApiError whose code was derived from the HTTP status. */
function messageForError(err: unknown): string {
  const m = t.admin.imageUpload;
  const code =
    err instanceof AdminApiError
      ? imageUploadErrorCode(err.status, err.code)
      : err instanceof Error && err.message in codeByName
        ? codeByName[err.message]
        : "upload_failed";
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

// Pre-check failures are thrown as Errors whose message is one of these keys,
// so messageForError resolves them the same way as a server code.
const codeByName: Record<string, ReturnType<typeof imageUploadErrorCode>> = {
  PRECHECK_TOO_LARGE: "image_too_large",
  PRECHECK_BAD_TYPE: "image_bad_type",
};

export interface ImageUploadFieldProps {
  /** Current URL (empty string = no image). Kept in sync with the manual input. */
  value: string;
  /** Called with the new URL on upload success, on manual edit, and with "" on clear. */
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
}

/**
 * Reusable «Загрузить фото» widget: upload a file to the live media endpoint OR
 * paste a URL by hand — both write the same `value`. Shows a small preview of
 * the current image, a spinner while uploading, and inline errors. Used for the
 * promo and event cover fields; reusable as-is for the stories cover next.
 */
export function ImageUploadField({ value, onChange, label, hint }: ImageUploadFieldProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const upload = useMutation({
    mutationFn: (file: File) => apiClient.uploadImage(file),
    onSuccess: (url) => {
      setError(null);
      setPreviewFailed(false);
      onChange(url);
    },
    onError: (err) => setError(messageForError(err)),
  });

  function pickFile() {
    setError(null);
    fileRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so selecting the SAME file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (!isAcceptedType(file.type)) {
      setError(messageForError(new Error("PRECHECK_BAD_TYPE")));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(messageForError(new Error("PRECHECK_TOO_LARGE")));
      return;
    }
    upload.mutate(file);
  }

  const trimmed = value.trim();
  const showPreview = trimmed.length > 0 && !previewFailed;

  return (
    <div className="flex flex-col gap-xs">
      {label ? (
        <span className="text-sm font-medium text-text" id={`${inputId}-label`}>
          {label}
        </span>
      ) : null}

      <div className="flex items-start gap-md">
        {showPreview ? (
          /* An operator-pasted R2 URL is not a known-at-build asset; next/image
             would need domain allowlisting for arbitrary hosts. A plain <img>
             with a graceful onError is the right tool for a preview thumbnail. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trimmed}
            alt={t.admin.imageUpload.previewAlt}
            className="h-16 w-16 shrink-0 rounded-card border border-hairline object-cover"
            onError={() => setPreviewFailed(true)}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-sm">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={pickFile}
            loading={upload.isPending}
            disabled={upload.isPending}
          >
            {upload.isPending
              ? t.admin.imageUpload.uploading
              : trimmed
                ? t.admin.imageUpload.replaceButton
                : t.admin.imageUpload.uploadButton}
          </Button>
          {trimmed ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={upload.isPending}
              aria-label={t.admin.imageUpload.removeLabel}
              onClick={() => {
                setError(null);
                setPreviewFailed(false);
                onChange("");
              }}
            >
              {t.admin.imageUpload.remove}
            </Button>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onFileSelected}
        />
      </div>

      <label htmlFor={inputId} className="flex flex-col gap-xxs">
        <span className="text-[12px] text-text-muted">{t.admin.imageUpload.urlLabel}</span>
        <TextInput
          id={inputId}
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => {
            setPreviewFailed(false);
            setError(null);
            onChange(e.target.value);
          }}
          placeholder={t.admin.imageUpload.urlPlaceholder}
          maxLength={2048}
          disabled={upload.isPending}
        />
      </label>

      {hint ? <span className="text-[12px] text-text-muted">{hint}</span> : null}

      {error ? (
        <p role="alert" className="text-sm text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}
