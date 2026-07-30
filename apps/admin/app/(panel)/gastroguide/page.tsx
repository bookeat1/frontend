"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { GuideCollectionDetailView } from "@/components/gastroguide/GuideCollectionDetailView";
import { GuideCollectionsView } from "@/components/gastroguide/GuideCollectionsView";
import { LoadingState } from "@/components/StateViews";

/**
 * List and detail share one route, and the collection is selected with
 * `?collection=<id>` rather than a `[id]` path segment.
 *
 * Why: the panel is built with `output: "export"` and served by Caddy as static
 * files — there is no Node process behind it. A dynamic segment would need
 * generateStaticParams, i.e. the set of collection ids at BUILD time, which is
 * exactly the thing an editor changes at runtime. A query parameter is the
 * honest shape for "which row am I looking at" in a statically exported app.
 */
function GastroguideScreen() {
  const collectionId = useSearchParams().get("collection");
  return collectionId ? (
    <GuideCollectionDetailView collectionId={collectionId} />
  ) : (
    <GuideCollectionsView />
  );
}

export default function GastroguidePage() {
  // useSearchParams suspends during prerender; without this boundary the export
  // of this page fails rather than falling back.
  return (
    <Suspense fallback={<LoadingState />}>
      <GastroguideScreen />
    </Suspense>
  );
}
