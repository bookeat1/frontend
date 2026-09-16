#!/usr/bin/env bash
# Promote an already-uploaded release of the venue panel to live.
# Usage: release.sh <release-name>   (directory must exist in $ROOT/releases)
set -euo pipefail
ROOT=${ADMIN_ROOT:-/opt/bookeat/admin}
rel=${1:?usage: release.sh <release-name>}
[ -d "$ROOT/releases/$rel" ] || { echo "release $rel not uploaded" >&2; exit 1; }
current=$(basename "$(readlink "$ROOT/current" 2>/dev/null || echo none)")
ln -sfn "releases/$rel" "$ROOT/.current.tmp"
mv -T "$ROOT/.current.tmp" "$ROOT/current"
printf '%s\t%s\trelease: %s -> %s\n' "$(date -u +%FT%TZ)" "${USER:-unknown}" "$current" "$rel" >> "$ROOT/releases.log"
[ "$current" = none ] || echo "$current" > "$ROOT/.previous"
echo "now serving $rel (was $current)"
