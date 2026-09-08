#!/usr/bin/env bash
#
# Roll the guest app's web preview (/preview on the TEST server) back to the
# previous release by moving one symlink. No rebuild, no upload, no Caddy
# reload, no downtime. The venue panel (/admin-preview), the desktop site
# (/web-preview) and the backend are not touched.
#
# Usage, straight from a laptop:
#   ssh -i ~/.ssh/bookeat_deploy ubuntu@213.155.20.122 \
#     '/opt/bookeat/preview/bin/mobile-rollback.sh'
#
# With an explicit release (see `ls /opt/bookeat/preview/mobile-releases`):
#   ... 'mobile-rollback.sh 20260908-120501-2cf837e'
set -euo pipefail

PREVIEW_ROOT="${PREVIEW_ROOT:-/opt/bookeat/preview}"
RELEASES_DIR="$PREVIEW_ROOT/mobile-releases"
LINK="$PREVIEW_ROOT/mobile-preview"

target="${1:-$(cat "$RELEASES_DIR/.previous" 2>/dev/null || true)}"
[ -n "$target" ] || { echo "no previous release recorded; pass one explicitly" >&2; exit 2; }
[ -d "$RELEASES_DIR/$target" ] || { echo "release $target does not exist" >&2; exit 2; }

current="$(readlink "$LINK" 2>/dev/null | sed 's|^mobile-releases/||' || true)"
[ "$current" != "$target" ] || { echo "already serving $target, nothing to do"; exit 0; }

ln -sfn "mobile-releases/$target" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

# The release we just left becomes the rollback target, so a second run of this
# script undoes the rollback instead of walking further back into history.
[ -n "$current" ] && printf '%s\n' "$current" > "$RELEASES_DIR/.previous"
printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$target" "rollback" \
  >> "$RELEASES_DIR/.history"

echo "serving: $(readlink "$LINK")"
