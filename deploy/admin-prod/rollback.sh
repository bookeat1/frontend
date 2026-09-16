#!/usr/bin/env bash
# Instantly switch the production venue panel (admin.book-eat.com) back to the
# previously served release. Caddy is NOT touched: its root is
# /srv/admin/current, a relative symlink inside /opt/bookeat/admin, and the swap
# is a single atomic rename(2) — a request gets either the whole old release or
# the whole new one, never a mix.
set -euo pipefail
ROOT=${ADMIN_ROOT:-/opt/bookeat/admin}
target=${1:-$(cat "$ROOT/.previous" 2>/dev/null || true)}
[ -n "$target" ] || { echo "no rollback target: pass a release name or populate $ROOT/.previous" >&2; exit 1; }
[ -d "$ROOT/releases/$target" ] || { echo "release $target does not exist in $ROOT/releases" >&2; exit 1; }
current=$(basename "$(readlink "$ROOT/current")")
ln -sfn "releases/$target" "$ROOT/.current.tmp"
mv -T "$ROOT/.current.tmp" "$ROOT/current"
printf '%s\t%s\trollback: %s -> %s\n' "$(date -u +%FT%TZ)" "${USER:-unknown}" "$current" "$target" >> "$ROOT/releases.log"
echo "$current" > "$ROOT/.previous"
echo "now serving $target (was $current)"
