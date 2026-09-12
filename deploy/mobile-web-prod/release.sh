#!/usr/bin/env bash
#
# Publish an already-uploaded Expo web build of the guest app (apps/mobile) in
# PRODUCTION (213.155.20.76). Runs ON the server, not on the runner.
#
# Layout it maintains under $MW_ROOT (/opt/bookeat/mobile-web, bind-mounted
# read-only into the mobileprod-web-mobile-1 container at /srv/mobile):
#
#   docker-compose.yml            the one-container stack (project "mobileprod")
#   caddy/Caddyfile               the static server's config
#   current                       -> symlink, what the container serves
#   releases/<release>/           immutable release directories
#   releases/.incoming-<release>/ upload in progress (never served)
#   releases/.previous            name of the release to roll back to
#   releases/.history             tab-separated log: time, release, actor
#   bin/mobile-release.sh, bin/mobile-rollback.sh
#
# Same scheme as the test slot (deploy/mobile-web/release.sh) and the desktop
# site (deploy/web-prod/release.sh). The symlink is RELATIVE on purpose: the
# tree is mounted at /srv/mobile inside the container.
#
# Usage: mobile-release.sh <release-name>
set -euo pipefail

MW_ROOT="${MW_ROOT:-/opt/bookeat/mobile-web}"
RELEASES_DIR="$MW_ROOT/releases"
LINK="$MW_ROOT/current"
COMPOSE="$MW_ROOT/docker-compose.yml"
SERVICE="web-mobile"
CONTAINER="mobileprod-web-mobile-1"
KEEP="${KEEP_RELEASES:-5}"

release="${1:?usage: mobile-release.sh <release-name>}"
case "$release" in
  */*|.*|"") echo "release name must be a plain directory name" >&2; exit 2 ;;
esac

incoming="$RELEASES_DIR/.incoming-$release"
target="$RELEASES_DIR/$release"

[ -d "$incoming" ] || { echo "no upload found at $incoming" >&2; exit 2; }
[ -f "$COMPOSE" ] || { echo "no compose file at $COMPOSE" >&2; exit 2; }
[ -f "$MW_ROOT/caddy/Caddyfile" ] || { echo "no $MW_ROOT/caddy/Caddyfile" >&2; exit 2; }

# A build without its entry point, or with an empty JS bundle, is not a
# release. Refuse before the swap rather than serve a white screen.
for required in index.html metadata.json release.txt; do
  [ -s "$incoming/$required" ] || { echo "upload is incomplete: $required missing or empty" >&2; exit 2; }
done
bundles="$(find "$incoming/_expo/static/js/web" -maxdepth 1 -name '*.js' -size +100k 2>/dev/null | wc -l)"
[ "$bundles" -ge 1 ] || {
  echo "upload is incomplete: no JS bundle larger than 100 KB under _expo/static/js/web" >&2
  exit 2
}
# Production serves from the domain root: a build made for the test slot
# (/preview) would 404 on every asset here.
grep -q '"/_expo/' "$incoming/index.html" || {
  echo "upload was built with the wrong base URL: index.html does not reference \"/_expo/ at the root" >&2
  exit 2
}
if grep -q '/preview/_expo/' "$incoming/index.html"; then
  echo "refusing: this is a test-slot build (base URL /preview), not a production one" >&2
  exit 2
fi
if grep -rq 'test.backend.book-eat.com' "$incoming/_expo/static/js/web"; then
  echo "refusing: the TEST backend address is present in this bundle" >&2
  exit 2
fi

previous="$(readlink "$LINK" 2>/dev/null | sed 's|^releases/||' || true)"

rm -rf "$target"
mv "$incoming" "$target"

# Atomic swap: rename(2) over the old link, so the symlink is never absent.
ln -sfn "releases/$release" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

# Static files: the server resolves `current` on every request, so the swap is
# live already. `up -d` only starts the container the first time (or applies a
# changed docker-compose.yml / Caddyfile); an unchanged, running container is
# left alone. Only the "mobileprod" project is touched.
docker compose -f "$COMPOSE" up -d "$SERVICE"

deadline=$(( $(date +%s) + 60 ))
status=""
while [ "$(date +%s)" -lt "$deadline" ]; do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)"
  [ "$status" = "healthy" ] && break
  sleep 3
done
if [ "$status" != "healthy" ]; then
  echo "container did not become healthy (last status: ${status:-unknown})" >&2
  docker compose -f "$COMPOSE" logs --tail 30 "$SERVICE" >&2 || true
  exit 1
fi

served="$(docker exec "$CONTAINER" wget -q -O - http://127.0.0.1:3200/release.txt 2>/dev/null | head -1 || true)"
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
# target. Each release is ~20 MB.
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
