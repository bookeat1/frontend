#!/usr/bin/env bash
#
# Publish an already-uploaded Expo web build of the guest app (apps/mobile) on
# the TEST server by moving a symlink. Runs ON the test server
# (213.155.20.122), not on the runner.
#
# Layout it maintains under $PREVIEW_ROOT (/opt/bookeat/preview, bind-mounted
# read-only into Caddy at /srv/preview):
#
#   mobile-preview                       -> symlink, what Caddy serves at /preview
#   mobile-releases/<release>/           immutable release directories
#   mobile-releases/.incoming-<release>/ upload in progress (never served)
#   mobile-releases/.previous            name of the release to roll back to
#   mobile-releases/.history             one line per swap
#   bin/mobile-release.sh, bin/mobile-rollback.sh
#
# Same scheme as the venue panel (admin-preview -> admin-releases/<release>,
# deploy/admin-test/release.sh). The scripts are named mobile-* because both
# pipelines share $PREVIEW_ROOT/bin: a plain release.sh here would overwrite
# the panel's on every deploy, and vice versa.
#
# The symlink is RELATIVE on purpose: Caddy sees this tree at /srv/preview, so
# an absolute host path would not resolve inside the container.
#
# The hand-copied build that used to live loose at the root of $PREVIEW_ROOT
# (index.html, _expo/, assets/, favicon.ico, metadata.json from 2026-07-23) is
# deliberately NOT touched by this script. Caddy stops looking there the moment
# its root becomes /srv/preview/mobile-preview (bookeat1/backend
# deploy/Caddyfile); removing those files is a manual step in README.md.
#
# Usage: mobile-release.sh <release-name>
set -euo pipefail

PREVIEW_ROOT="${PREVIEW_ROOT:-/opt/bookeat/preview}"
RELEASES_DIR="$PREVIEW_ROOT/mobile-releases"
LINK="$PREVIEW_ROOT/mobile-preview"
KEEP="${KEEP_RELEASES:-5}"

release="${1:?usage: mobile-release.sh <release-name>}"
case "$release" in
  */*|.*|"") echo "release name must be a plain directory name" >&2; exit 2 ;;
esac

incoming="$RELEASES_DIR/.incoming-$release"
target="$RELEASES_DIR/$release"

[ -d "$incoming" ] || { echo "no upload found at $incoming" >&2; exit 2; }

# A build without its entry point, or with an empty JS bundle, is not a
# release. Refuse before the swap rather than serve a white screen.
for required in index.html metadata.json release.txt; do
  [ -s "$incoming/$required" ] || { echo "upload is incomplete: $required missing or empty" >&2; exit 2; }
done
bundle_bytes="$(find "$incoming/_expo/static/js/web" -maxdepth 1 -name '*.js' -size +100k 2>/dev/null | wc -l)"
[ "$bundle_bytes" -ge 1 ] || {
  echo "upload is incomplete: no JS bundle larger than 100 KB under _expo/static/js/web" >&2
  exit 2
}
grep -q '/preview/_expo/' "$incoming/index.html" || {
  echo "upload was built with the wrong base URL: index.html does not reference /preview/_expo/" >&2
  exit 2
}

previous="$(readlink "$LINK" 2>/dev/null | sed 's|^mobile-releases/||' || true)"

rm -rf "$target"
mv "$incoming" "$target"

# Atomic swap: create the new link under a temp name, then rename it over the
# old one. rename(2) is atomic, so a request either gets the whole old release
# or the whole new one, never a missing file.
ln -sfn "mobile-releases/$release" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

if [ -n "$previous" ] && [ "$previous" != "$release" ]; then
  printf '%s\n' "$previous" > "$RELEASES_DIR/.previous"
fi
printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$release" "${DEPLOY_ACTOR:-unknown}" \
  >> "$RELEASES_DIR/.history"

# Keep the newest $KEEP releases, and never delete the live one or the rollback
# target, whatever their age. Each release is ~45 MB uncompressed (10 MB of
# JS, the rest venue photos under assets/).
current="$release"
prev="$(cat "$RELEASES_DIR/.previous" 2>/dev/null || true)"
find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
  | grep -v '^\.' | sort -r | tail -n "+$((KEEP + 1))" | while read -r old; do
  [ "$old" = "$current" ] && continue
  [ "$old" = "$prev" ] && continue
  echo "pruning old release $old"
  rm -rf "${RELEASES_DIR:?}/$old"
done

echo "serving: $(readlink "$LINK")"
echo "rollback target: ${prev:-none}"
