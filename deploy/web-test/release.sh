#!/usr/bin/env bash
#
# Publish an already-uploaded desktop-site build on the TEST server
# (213.155.20.122). Runs ON the server, not on the CI runner.
#
# Layout it maintains under $WEB_ROOT (/opt/bookeat/web-preview):
#
#   docker-compose.yml            the one-container stack (project "webpreview")
#   current                       -> symlink, what the container runs
#   releases/<release>/           immutable release directories
#   releases/.incoming-<release>/ upload in progress (never run)
#   releases/.previous            name of the release to roll back to
#   bin/release.sh, bin/rollback.sh
#
# The symlink is RELATIVE on purpose: the tree is bind-mounted at /srv/web
# inside the container, so an absolute host path would not resolve there.
#
# Usage: release.sh <release-name>
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/opt/bookeat/web-preview}"
RELEASES_DIR="$WEB_ROOT/releases"
LINK="$WEB_ROOT/current"
COMPOSE="$WEB_ROOT/docker-compose.yml"
KEEP="${KEEP_RELEASES:-5}"

release="${1:?usage: release.sh <release-name>}"
case "$release" in
  */*|.*|"") echo "release name must be a plain directory name" >&2; exit 2 ;;
esac

incoming="$RELEASES_DIR/.incoming-$release"
target="$RELEASES_DIR/$release"

[ -d "$incoming" ] || { echo "no upload found at $incoming" >&2; exit 2; }

# A build missing its entry point or its client assets is not a release. Refuse
# before the swap rather than serve a hole.
for required in apps/web/server.js apps/web/.next/BUILD_ID node_modules/next/package.json; do
  [ -e "$incoming/$required" ] || { echo "upload is incomplete: $required missing" >&2; exit 2; }
done
[ -d "$incoming/apps/web/.next/static" ] || { echo "upload is incomplete: .next/static missing" >&2; exit 2; }

# The release tree is bind-mounted READ-ONLY, and Docker cannot create a
# mountpoint inside a read-only mount. The tmpfs that gives Next a writable
# .next/cache therefore needs the directory to exist in the release already.
# Created here rather than in CI so any artifact, however assembled, boots.
mkdir -p "$incoming/apps/web/.next/cache"

previous="$(readlink "$LINK" 2>/dev/null | sed 's|^releases/||' || true)"

rm -rf "$target"
mv "$incoming" "$target"

# Atomic swap: rename(2) over the old link, so the symlink is never absent.
ln -sfn "releases/$release" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

# Unlike the static admin panel, a running Node process keeps the OLD release
# loaded in memory — the symlink swap alone changes nothing. `up -d` applies any
# change to docker-compose.yml too; `restart` alone would not.
#
# This touches ONLY the "webpreview" project. The backend stack lives in a
# different compose project and is not passed to this command.
docker compose -f "$COMPOSE" up -d --force-recreate web-preview

# Wait for the container's own healthcheck instead of assuming.
deadline=$(( $(date +%s) + 90 ))
status=""
while [ "$(date +%s)" -lt "$deadline" ]; do
  status="$(docker inspect -f '{{.State.Health.Status}}' webpreview-web-preview-1 2>/dev/null || echo missing)"
  [ "$status" = "healthy" ] && break
  sleep 3
done
if [ "$status" != "healthy" ]; then
  echo "container did not become healthy (last status: ${status:-unknown})" >&2
  docker compose -f "$COMPOSE" logs --tail 50 web-preview >&2 || true
  exit 1
fi

if [ -n "$previous" ] && [ "$previous" != "$release" ]; then
  printf '%s\n' "$previous" > "$RELEASES_DIR/.previous"
fi
printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$release" "${DEPLOY_ACTOR:-unknown}" \
  >> "$RELEASES_DIR/.history"

# Keep the newest $KEEP releases; never delete the live one or the rollback
# target, whatever their age. Each release is ~70 MB.
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
