#!/usr/bin/env bash
#
# Publish an already-uploaded desktop-site build in PRODUCTION
# (213.155.20.76). Runs ON the server, not on the CI runner.
#
# Layout it maintains under $WEB_ROOT (/opt/bookeat/web):
#
#   docker-compose.yml            the one-container stack (project "webprod")
#   current                       -> symlink, what the container runs
#   releases/<release>/           immutable release directories
#   releases/.incoming-<release>/ upload in progress (never run)
#   releases/.previous            name of the release to roll back to
#   releases/.history             tab-separated log: time, release, actor
#   bin/release.sh, bin/rollback.sh
#
# The symlink is RELATIVE on purpose: the tree is bind-mounted at /srv/web
# inside the container, so an absolute host path would not resolve there.
#
# Same script as deploy/web-test/release.sh with production names; keep the
# two in step when fixing something here.
#
# Usage: release.sh <release-name>
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/opt/bookeat/web}"
RELEASES_DIR="$WEB_ROOT/releases"
LINK="$WEB_ROOT/current"
COMPOSE="$WEB_ROOT/docker-compose.yml"
SERVICE="web-prod"
CONTAINER="webprod-web-prod-1"
KEEP="${KEEP_RELEASES:-5}"

release="${1:?usage: release.sh <release-name>}"
case "$release" in
  */*|.*|"") echo "release name must be a plain directory name" >&2; exit 2 ;;
esac

incoming="$RELEASES_DIR/.incoming-$release"
target="$RELEASES_DIR/$release"

[ -d "$incoming" ] || { echo "no upload found at $incoming" >&2; exit 2; }
[ -f "$COMPOSE" ] || { echo "no compose file at $COMPOSE — the deploy did not upload it" >&2; exit 2; }

# A build missing its entry point or its client assets is not a release. Refuse
# before the swap rather than serve a hole.
for required in apps/web/server.js apps/web/.next/BUILD_ID node_modules/next/package.json apps/web/public/release.txt; do
  [ -e "$incoming/$required" ] || { echo "upload is incomplete: $required missing" >&2; exit 2; }
done
[ -d "$incoming/apps/web/.next/static" ] || { echo "upload is incomplete: .next/static missing" >&2; exit 2; }

# A stand build (basePath=/web-preview) must never be promoted here: every
# asset URL would point at a path Caddy does not route on this domain.
if grep -q '"basePath":"/' "$incoming/apps/web/server.js"; then
  echo "refusing: this build has a non-empty basePath — it is a stand build, not a production one" >&2
  exit 2
fi

# The release tree is bind-mounted READ-ONLY, and Docker cannot create a
# mountpoint inside a read-only mount. The tmpfs that gives Next a writable
# .next/cache therefore needs the directory to exist in the release already.
mkdir -p "$incoming/apps/web/.next/cache"

previous="$(readlink "$LINK" 2>/dev/null | sed 's|^releases/||' || true)"

rm -rf "$target"
mv "$incoming" "$target"

# Atomic swap: rename(2) over the old link, so the symlink is never absent.
ln -sfn "releases/$release" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

# A running Node process keeps the OLD release loaded in memory — the symlink
# swap alone changes nothing. `up -d` applies any change to docker-compose.yml
# too; `restart` alone would not. The site blinks for the container start
# (a few seconds); Caddy answers 502 for that window.
#
# This touches ONLY the "webprod" project. The backend stack lives in a
# different compose project and is not passed to this command.
docker compose -f "$COMPOSE" up -d --force-recreate "$SERVICE"

# Wait for the container's own healthcheck instead of assuming.
deadline=$(( $(date +%s) + 120 ))
status=""
while [ "$(date +%s)" -lt "$deadline" ]; do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)"
  [ "$status" = "healthy" ] && break
  sleep 3
done
if [ "$status" != "healthy" ]; then
  echo "container did not become healthy (last status: ${status:-unknown})" >&2
  docker compose -f "$COMPOSE" logs --tail 50 "$SERVICE" >&2 || true
  exit 1
fi

# Healthy is not enough: prove the process serves THIS release, from inside
# the container, before the caller trusts the swap.
served="$(docker exec "$CONTAINER" wget -q -O - http://127.0.0.1:3100/release.txt 2>/dev/null | head -1 || true)"
if [ "$served" != "$release" ]; then
  echo "container is healthy but serves '${served:-nothing}', expected $release" >&2
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
