#!/usr/bin/env bash
#
# Roll the mobile web (book-eat.com, mobile User-Agents) back to the previous
# release by moving one symlink. No rebuild, no upload, no container restart,
# no Caddy reload, no downtime. The desktop site, the venue panel and the
# backend are not touched.
#
# Usage, straight from a laptop:
#   ssh -i ~/.ssh/bookeat_deploy ubuntu@213.155.20.76 \
#     '/opt/bookeat/mobile-web/bin/mobile-rollback.sh'
#
# With an explicit release (see `ls /opt/bookeat/mobile-web/releases`):
#   ... 'mobile-rollback.sh 20260908-160000-48c357b'
set -euo pipefail

MW_ROOT="${MW_ROOT:-/opt/bookeat/mobile-web}"
RELEASES_DIR="$MW_ROOT/releases"
LINK="$MW_ROOT/current"

target="${1:-$(cat "$RELEASES_DIR/.previous" 2>/dev/null || true)}"
[ -n "$target" ] || { echo "no previous release recorded; pass one explicitly" >&2; exit 2; }
[ -d "$RELEASES_DIR/$target" ] || { echo "release $target does not exist" >&2; exit 2; }

current="$(readlink "$LINK" 2>/dev/null | sed 's|^releases/||' || true)"
[ "$current" != "$target" ] || { echo "already serving $target, nothing to do"; exit 0; }

ln -sfn "releases/$target" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"

[ -n "$current" ] && printf '%s\n' "$current" > "$RELEASES_DIR/.previous"
printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$target" "rollback" \
  >> "$RELEASES_DIR/.history"

echo "serving: $(readlink "$LINK")"
