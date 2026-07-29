#!/usr/bin/env bash
#
# Publish an already-uploaded venue panel build on the TEST server by moving a
# symlink. Runs ON the test server (213.155.20.122), not on the runner.
#
# Layout it maintains under $PREVIEW_ROOT:
#
#   admin-preview                      -> symlink, what Caddy serves
#   admin-releases/<release>/          immutable release directories
#   admin-releases/.incoming-<release>/ upload in progress (never served)
#   admin-releases/.previous           name of the release to roll back to
#
# The symlink is RELATIVE on purpose: Caddy sees this tree bind-mounted at
# /srv/preview, so an absolute host path would not resolve inside the container.
#
# Usage: release.sh <release-name>
set -euo pipefail

PREVIEW_ROOT="${PREVIEW_ROOT:-/opt/bookeat/preview}"
RELEASES_DIR="$PREVIEW_ROOT/admin-releases"
LINK="$PREVIEW_ROOT/admin-preview"
KEEP="${KEEP_RELEASES:-5}"

release="${1:?usage: release.sh <release-name>}"
case "$release" in
  */*|.*|"") echo "release name must be a plain directory name" >&2; exit 2 ;;
esac

incoming="$RELEASES_DIR/.incoming-$release"
target="$RELEASES_DIR/$release"

[ -d "$incoming" ] || { echo "no upload found at $incoming" >&2; exit 2; }

# A build that is missing its entry point is not a release. Refuse before the
# swap rather than serve a hole.
for required in index.html sw.js login/index.html; do
  [ -f "$incoming/$required" ] || { echo "upload is incomplete: $required missing" >&2; exit 2; }
done

# First run migrates the hand-rolled layout: admin-preview used to be a real
# directory. Keep it as a release so the very first automated deploy still has
# something to roll back to.
if [ -d "$LINK" ] && [ ! -L "$LINK" ]; then
  legacy="manual-$(date -u -r "$LINK" +%Y%m%d-%H%M%S)"
  echo "migrating pre-existing directory to $RELEASES_DIR/$legacy"
  mkdir -p "$RELEASES_DIR"
  mv "$LINK" "$RELEASES_DIR/$legacy"
  ln -sfn "admin-releases/$legacy" "$LINK"
fi

previous="$(readlink "$LINK" 2>/dev/null | sed 's|^admin-releases/||' || true)"

rm -rf "$target"
mv "$incoming" "$target"

# Atomic swap: create the new link under a temp name, then rename it over the
# old one. rename(2) is atomic, so a request either gets the whole old release
# or the whole new one, never a missing file.
ln -sfn "admin-releases/$release" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

if [ -n "$previous" ] && [ "$previous" != "$release" ]; then
  printf '%s\n' "$previous" > "$RELEASES_DIR/.previous"
fi
printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$release" "${DEPLOY_ACTOR:-unknown}" \
  >> "$RELEASES_DIR/.history"

# Keep the newest $KEEP releases, and never delete the live one or the rollback
# target, whatever their age.
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
