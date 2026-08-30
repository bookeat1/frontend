#!/usr/bin/env bash
#
# Roll the desktop-site preview on the TEST server back to the previous release:
# move one symlink, recreate one container. No rebuild, no upload, no Caddy
# reload. The backend stack is not touched; only /web-preview blinks, for a few
# seconds.
#
# Usage, straight from a laptop:
#   ssh -i ~/.ssh/bookeat_deploy ubuntu@213.155.20.122 \
#     '/opt/bookeat/web-preview/bin/rollback.sh'
#
# With an explicit release (see `ls /opt/bookeat/web-preview/releases`):
#   ... 'rollback.sh 20260830-120501-2cf837e'
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/opt/bookeat/web-preview}"
RELEASES_DIR="$WEB_ROOT/releases"
LINK="$WEB_ROOT/current"
COMPOSE="$WEB_ROOT/docker-compose.yml"

target="${1:-$(cat "$RELEASES_DIR/.previous" 2>/dev/null || true)}"
[ -n "$target" ] || { echo "no previous release recorded; pass one explicitly" >&2; exit 2; }
[ -d "$RELEASES_DIR/$target" ] || { echo "release $target does not exist" >&2; exit 2; }

current="$(readlink "$LINK" 2>/dev/null | sed 's|^releases/||' || true)"
[ "$current" != "$target" ] || { echo "already serving $target, nothing to do"; exit 0; }

ln -sfn "releases/$target" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

docker compose -f "$COMPOSE" up -d --force-recreate web-preview

# The release we just left becomes the rollback target, so a second run of this
# script undoes the rollback instead of walking further back into history.
[ -n "$current" ] && printf '%s\n' "$current" > "$RELEASES_DIR/.previous"
printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$target" "rollback" \
  >> "$RELEASES_DIR/.history"

echo "serving: $(readlink "$LINK")"
