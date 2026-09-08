#!/usr/bin/env bash
#
# Roll the desktop site in PRODUCTION back to the previous release: move one
# symlink, recreate one container. No rebuild, no upload, no Caddy reload.
# The backend stack is not touched; only book-eat.com blinks, for a few
# seconds (Caddy answers 502 while the container restarts).
#
# Usage, straight from a laptop:
#   ssh -i ~/.ssh/bookeat_deploy ubuntu@213.155.20.76 \
#     '/opt/bookeat/web/bin/rollback.sh'
#
# With an explicit release (see `ls /opt/bookeat/web/releases`):
#   ... 'rollback.sh 20260907-120501-2cf837e'
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/opt/bookeat/web}"
RELEASES_DIR="$WEB_ROOT/releases"
LINK="$WEB_ROOT/current"
COMPOSE="$WEB_ROOT/docker-compose.yml"
SERVICE="web-prod"
CONTAINER="webprod-web-prod-1"

target="${1:-$(cat "$RELEASES_DIR/.previous" 2>/dev/null || true)}"
[ -n "$target" ] || { echo "no previous release recorded; pass one explicitly" >&2; exit 2; }
[ -d "$RELEASES_DIR/$target" ] || { echo "release $target does not exist" >&2; exit 2; }

current="$(readlink "$LINK" 2>/dev/null | sed 's|^releases/||' || true)"
[ "$current" != "$target" ] || { echo "already serving $target, nothing to do"; exit 0; }

ln -sfn "releases/$target" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

docker compose -f "$COMPOSE" up -d --force-recreate "$SERVICE"

# The release we just left becomes the rollback target, so a second run of this
# script undoes the rollback instead of walking further back into history.
[ -n "$current" ] && printf '%s\n' "$current" > "$RELEASES_DIR/.previous"
printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$target" "rollback" \
  >> "$RELEASES_DIR/.history"

# Wait for the container so the operator sees "serving" only once it is true.
deadline=$(( $(date +%s) + 120 ))
status=""
while [ "$(date +%s)" -lt "$deadline" ]; do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)"
  [ "$status" = "healthy" ] && break
  sleep 3
done
if [ "$status" != "healthy" ]; then
  echo "rolled the symlink back to $target, but the container is '${status:-unknown}' — check: docker compose -f $COMPOSE logs --tail 50 $SERVICE" >&2
  exit 1
fi

echo "serving: $(readlink "$LINK")"
